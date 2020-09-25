import UploadPart from './index'

// config = {
//   accessKeyId: 'your accessKeyId',
//   secretAccessKey: 'your secretAccessKey',
//   apiVersion: '2006-03-01',
//   region: 'your region',
// }

// options = {
//   queueSize: 1,
//   connectTimeout: 1000 * 10,
//   httpOptions: {
//     timeout: 1000 * 60 * 60 * 2,
//   },
// }

const u = new UploadPart({ config: {}, options: {}, Bucket: '' })

// 进度
u.on('progress', (percent) => {
  // percent 进度
})

// 成功事件
u.on('success', ({ Location, ETag, Key, Bucket }) => {
  //
})

// 错误事件
u.on('error', (err) => {})

// 中断事件
u.on('abort', (err) => {})

// params ={
//   file:'your file',file或者blob文件
//   Key:'your Key',存储路径+文件名
//   chunkSize:'每个块的大小 默认5m',传入数值,默认 5
// }
u.send(params)

// 续传方法
u.continue()

// 关闭本次上传
u.abort()
