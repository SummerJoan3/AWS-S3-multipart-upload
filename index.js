import AWS from 'aws-sdk'

const eventKey = ['progress', 'success', 'error', 'abort']

class UploadPart {
  constructor(props) {
    const { config = {}, options = {} } = props || {}
    // OSS参数
    this.config = config
    this.options = options

    // 上传成功的分片返回值
    this.parts = []

    // OSS实例
    this.instance = null
    // 上传ID
    this.UploadId = null
    this.Bucket = null
    this.Key = null

    // 监听事件
    this.event = {}
    // 剩余上传队列
    this.uploadEventQueue = []
    this.totalEvent = 0
    // 状态
    this.status = 'PENDING'
    // 错误信息
    this.errorMsg = ''
  }

  init(props) {
    return new Promise((resolve, reject) => {
      const { Bucket = 'your Bucket' } = props || {}
      const defaultConfig = {
        accessKeyId: 'your accessKeyId',
        secretAccessKey: 'your secretAccessKey',
        apiVersion: '2006-03-01',
        region: 'your region',
      }
      const mergeConfig = Object.assign({}, defaultConfig, this.config)

      AWS.config.update(mergeConfig)
      this.Bucket = Bucket
      const defaultOptions = {
        queueSize: 1,
        connectTimeout: 1000 * 10,
        httpOptions: {
          timeout: 1000 * 60 * 60 * 2,
        },
      }

      const mergeOptions = Object.assign({}, defaultOptions, this.options)
      this.instance = new AWS.S3(mergeOptions)
      resolve()
    })
  }

  fileSlice(file, chunkSize) {
    let totalSize = file.size // 文件总大小
    let start = 0 // 每次上传的开始字节
    let end = start + chunkSize // 每次上传的结尾字节
    let chunks = []
    while (start < totalSize) {
      let blob = file.slice(start, end)
      chunks.push(blob)
      start = end
      end = start + chunkSize
    }
    return chunks
  }

  _sendPart(chunkObj) {
    return new Promise((r, j) => {
      const { chunk, PartNumber } = chunkObj

      const params = {
        Bucket: this.Bucket,
        Body: chunk,
        Key: this.Key,
        UploadId: this.UploadId,
        PartNumber,
      }

      this.instance.uploadPart(params, (err, data) => {
        if (err) {
          // console.log(err);
          // {NoSuchUpload:''}
          this.callEvent('abort', err)
          this.status = 'ABORT'
          j()
        } else {
          const { ETag } = data
          const ETagObj = { ETag, PartNumber }
          this.parts.push(ETagObj)

          const remainEvent = this.totalEvent - this.uploadEventQueue.length + 1
          const progress = parseInt((remainEvent / this.totalEvent) * 100)
          this.callEvent('progress', progress)
          r()
        }
      })
    })
  }

  abort() {
    if (!this.instance) return
    const params = {
      Bucket: this.Bucket,
      Key: this.Key,
      UploadId: this.UploadId,
    }
    this.instance.abortMultipartUpload(params, function (err, data) {
      if (err) {
      }
    })
  }

  async executeTaskQueue() {
    this.status = 'UPLOADING'
    while (this.uploadEventQueue.length) {
      await this._sendPart(this.uploadEventQueue[0])
      this.uploadEventQueue.shift()
    }

    this.complete()
  }

  continue() {
    this.executeTaskQueue()
  }

  async getUploadId() {
    return new Promise((r, j) => {
      this.instance.createMultipartUpload({ Bucket: this.Bucket, Key: this.Key }, (err, data) => {
        if (err) {
          this.callEvent('error', err)
          j()
        } else {
          const { UploadId } = data
          this.UploadId = UploadId
          r()
        }
      })
    })
  }

  on(eventName, callback) {
    if (typeof callback === 'function' && eventKey.includes(eventName)) {
      this.event[eventName] = callback
    }
  }
  removeListener(eventName) {
    if (eventKey.includes(eventName)) {
      this.event[eventName] = null
    }
  }
  callEvent(eventName, params) {
    const getEvent = this.event[eventName]
    if (typeof getEvent === 'function') {
      getEvent(params)
    }
  }

  async _send() {
    await this.getUploadId()
    this.executeTaskQueue()
  }

  send(config) {
    await this.init();

    let { file, chunkSize = 5, Key = Math.random() } = config
    chunkSize = chunkSize * 1024 * 1024
    const { size } = file
    this.totalEvent = Math.ceil(size / chunkSize)
    this.Key = Key
    this.file = file

    const chunks = this.fileSlice(file, chunkSize)
    chunks.forEach((chunk, index) => {
      const chunkObj = {
        chunk,
        PartNumber: index + 1,
      }
      this.uploadEventQueue.push(chunkObj)
    })
    this._send()
  }

  reset() {
    this.UploadId = null;
    this.Key = null;
    this.Bucket = null;
    this.uploadEventQueue = [];
    this.parts = [];
  }

  complete() {
    let Parts = [...new Set(this.parts)]
    Parts = Parts.sort((a, b) => a.PartNumber - b.PartNumber)

    const params = {
      Bucket: this.Bucket,
      Key: this.Key,
      MultipartUpload: {
        Parts,
      },
      UploadId: this.UploadId,
    }
    this.instance.completeMultipartUpload(params, (err, data) => {
      if (err) {
        this.status = 'ERROR'
        this.callEvent('error', err)
      } else {
        this.status = 'SUCCESS'
        this.callEvent('success', data)
      }
      this.reset()
    })
  }
}

module.export = UploadPart
