import { useState, useRef, useCallback } from 'react'
import { UploadCloud, FileText, CheckCircle, XCircle, Loader, X, AlertTriangle } from 'lucide-react'
import { LIVE, uploadPickingSlip } from '../api'

async function mockUpload() {
  await new Promise(r => setTimeout(r, 1200 + Math.random() * 800))
  if (Math.random() < 0.08) throw new Error('Upload failed — check your connection and try again.')
  return { success: true }
}

// Read a File into base64 (without the data: prefix)
const toBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result).split(',')[1])
  reader.onerror = reject
  reader.readAsDataURL(file)
})

async function doUpload(file) {
  if (!LIVE) return mockUpload()
  const fileData = await toBase64(file)
  return uploadPickingSlip(file.name, fileData)
}

const fmtSize = (b) => b < 1048576 ? `${(b/1024).toFixed(0)} KB` : `${(b/1048576).toFixed(1)} MB`
const fmtTime = (d) => d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })

export default function UploadTab({ onUploaded }) {
  const [uploads, setUploads] = useState([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)
  const dragCounter = useRef(0)

  const updateUpload = (id, changes) => setUploads(prev => prev.map(u => u.id === id ? { ...u, ...changes } : u))

  const processFiles = useCallback(async (files) => {
    const pdfs = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    const rejected = Array.from(files).filter(f => !pdfs.includes(f))
    rejected.forEach(f => {
      const id = Math.random().toString(36).slice(2)
      setUploads(prev => [{ id, name: f.name, size: f.size, status: 'rejected', error: 'Not a PDF file', time: new Date() }, ...prev])
    })
    for (const file of pdfs) {
      const id = Math.random().toString(36).slice(2)
      setUploads(prev => [{ id, name: file.name, size: file.size, status: 'uploading', time: new Date() }, ...prev])
      try {
        await doUpload(file)
        updateUpload(id, { status: 'done' })
        onUploaded?.()
      } catch (err) {
        updateUpload(id, { status: 'error', error: err.message })
      }
    }
  }, [onUploaded])

  const onDragEnter = (e) => { e.preventDefault(); dragCounter.current++; setDragging(true) }
  const onDragLeave = (e) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current === 0) setDragging(false) }
  const onDragOver = (e) => e.preventDefault()
  const onDrop = (e) => { e.preventDefault(); dragCounter.current = 0; setDragging(false); processFiles(e.dataTransfer.files) }

  const statusIcon = (u) => ({
    uploading: <Loader size={16} className="text-blue-500 animate-spin" />,
    done:      <CheckCircle size={16} className="text-green-500" />,
    error:     <XCircle size={16} className="text-red-500" />,
    rejected:  <AlertTriangle size={16} className="text-amber-500" />,
  }[u.status])

  const pending = uploads.filter(u => u.status === 'uploading').length
  const done    = uploads.filter(u => u.status === 'done').length
  const errors  = uploads.filter(u => u.status === 'error').length

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Upload Picking Slips</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Drop PDFs here — they'll be sent to the incoming folder and processed automatically within 5 minutes.</p>
      </div>

      <div onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragOver} onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12 cursor-pointer transition-all duration-200 select-none
          ${dragging
            ? 'border-brand bg-brand/5 scale-[1.01]'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-brand/40 hover:bg-brand/5 dark:hover:bg-brand/5'}`}>
        <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple className="hidden"
          onChange={e => { processFiles(e.target.files); e.target.value = '' }} />

        <div className={`rounded-2xl p-4 transition-colors ${dragging ? 'bg-brand/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
          <UploadCloud size={32} className={dragging ? 'text-brand-dark' : 'text-slate-400 dark:text-slate-500'} />
        </div>
        <div className="text-center">
          <p className={`font-semibold text-base ${dragging ? 'text-[#111111]' : 'text-slate-700 dark:text-slate-300'}`}>
            {dragging ? 'Drop to upload' : 'Drag picking slips here'}
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">or click to browse — PDF files only</p>
        </div>
      </div>

      {uploads.length > 0 && (
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {pending > 0 && <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-full px-2.5 py-1"><Loader size={11} className="animate-spin" /> {pending} uploading</span>}
          {done    > 0 && <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-full px-2.5 py-1"><CheckCircle size={11} /> {done} uploaded</span>}
          {errors  > 0 && <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-full px-2.5 py-1"><XCircle size={11} /> {errors} failed</span>}
          <button onClick={() => setUploads([])} className="ml-auto text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Clear all</button>
        </div>
      )}

      {uploads.length > 0 && (
        <div className="mt-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {uploads.map(upload => (
              <li key={upload.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`p-2 rounded-lg shrink-0 ${
                  upload.status === 'done'     ? 'bg-green-50 dark:bg-green-900/30' :
                  upload.status === 'error'    ? 'bg-red-50 dark:bg-red-900/30' :
                  upload.status === 'rejected' ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-blue-50 dark:bg-blue-900/30'}`}>
                  <FileText size={14} className={
                    upload.status === 'done'     ? 'text-green-500' :
                    upload.status === 'error'    ? 'text-red-400' :
                    upload.status === 'rejected' ? 'text-amber-400' : 'text-blue-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{upload.name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {upload.error ? <span className="text-red-500">{upload.error}</span>
                      : upload.status === 'uploading' ? 'Uploading…'
                      : upload.status === 'done' ? `Sent to incoming folder · ${fmtSize(upload.size)}`
                      : fmtSize(upload.size)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-400 dark:text-slate-500">{fmtTime(upload.time)}</span>
                  {statusIcon(upload)}
                  <button onClick={() => setUploads(prev => prev.filter(u => u.id !== upload.id))}
                    className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors ml-1">
                    <X size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
