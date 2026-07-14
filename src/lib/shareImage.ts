import { toBlob } from 'html-to-image'

/**
 * Chụp 1 element DOM thành ảnh PNG rồi chia sẻ (Web Share API trên mobile)
 * hoặc tải xuống (fallback trên desktop / trình duyệt không hỗ trợ share file).
 */
export async function shareElementAsImage(
  el: HTMLElement,
  filename: string,
  shareTitle: string,
): Promise<void> {
  const blob = await toBlob(el, { backgroundColor: '#0f172a', pixelRatio: 2 })
  if (!blob) return

  const file = new File([blob], filename, { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: shareTitle })
      return
    } catch {
      // Người dùng huỷ share hoặc lỗi -> rơi xuống tải file bên dưới.
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
