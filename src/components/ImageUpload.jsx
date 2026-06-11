import { useState, useRef } from 'react'
import { uploadFileToS3 }   from '../api/api.js'
import { LiquidLoader }     from './ProgressiveImage.jsx'

export default function ImageUpload({
  folder    = 'uploads',
  onUpload,
  preview   = true,
  label     = 'Upload Photo',
  accept    = 'image/*',
  className = '',
  currentUrl = null,
}) {
  const [dragging,    setDragging]    = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [progress,    setProgress]    = useState(0)
  const [previewUrl,  setPreviewUrl]  = useState(currentUrl)
  const [imgLoaded,   setImgLoaded]   = useState(!!currentUrl)
  const [error,       setError]       = useState('')
  const inputRef = useRef(null)

  const handle = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setError('Please select a valid image file.')
      return
    }
    setError('')
    const startTime = Date.now()
    setUploading(true)
    setImgLoaded(false)
    setProgress(10)

    const localUrl = URL.createObjectURL(file)
    setPreviewUrl(localUrl)
    setProgress(30)

    try {
      const result = await uploadFileToS3(file, folder)
      setProgress(100)
      onUpload?.(result)
      // Always show loader for at least 2 seconds
      const elapsed = Date.now() - startTime
      await new Promise(r => setTimeout(r, Math.max(0, 2000 - elapsed)))
    } catch (e) {
      const elapsed = Date.now() - startTime
      await new Promise(r => setTimeout(r, Math.max(0, 2000 - elapsed)))
      setError(e.message || 'Upload failed. Check S3 credentials in .env')
      setPreviewUrl(currentUrl)
    } finally {
      setUploading(false)
      setTimeout(() => setProgress(0), 400)
    }
  }

  const onFileChange = (e) => handle(e.target.files[0])
  const onDrop       = (e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]) }

  return (
    <div className={`space-y-2 ${className}`}>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative glass-input cursor-pointer flex flex-col items-center justify-center gap-2 py-6 text-center transition-all duration-200 overflow-hidden
          ${dragging ? 'border-red-500 bg-red-900/10' : 'hover:border-white/20'}
          ${uploading ? 'pointer-events-none' : ''}`}
        style={{ borderRadius: '12px', borderStyle: 'dashed', minHeight: '110px' }}
      >
        {/* ── Liquid upload loader ── */}
        {uploading && (
          <div className="absolute inset-0" style={{ borderRadius: '12px', overflow: 'hidden' }}>
            <LiquidLoader progress={progress} label="Uploading…" />
          </div>
        )}

        {/* ── Preview image — revealed with fade after upload ── */}
        {preview && previewUrl && !uploading ? (
          <div className="relative w-full flex items-center justify-center" style={{ minHeight: 80 }}>
            {!imgLoaded && (
              <div className="absolute inset-0 rounded-lg overflow-hidden" style={{ minHeight: 80 }}>
                <LiquidLoader progress={85} />
              </div>
            )}
            <img
              src={previewUrl}
              alt="preview"
              className="max-h-32 max-w-full rounded-lg object-contain"
              style={{
                opacity: imgLoaded ? 1 : 0,
                animation: imgLoaded ? 'liq-reveal 0.5s ease-out forwards' : 'none',
              }}
              onLoad={() => setImgLoaded(true)}
            />
          </div>
        ) : !uploading ? (
          <>
            <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p className="font-inter text-xs text-gray-500">{label}</p>
            <p className="font-inter text-[10px] text-gray-700">Click or drag & drop</p>
          </>
        ) : null}
      </div>

      {previewUrl && !uploading && (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="font-inter text-[11px] text-red-400 hover:text-red-300 transition-colors">
          Change image
        </button>
      )}

      {error && <p className="font-inter text-xs text-red-400">{error}</p>}
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onFileChange} />
    </div>
  )
}
