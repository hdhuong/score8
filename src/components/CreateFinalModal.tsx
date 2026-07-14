const RACE_TO_OPTIONS = [3, 4, 5, 7]

interface Props {
  onCreate: (raceTo: number) => void
  onClose: () => void
}

export default function CreateFinalModal({ onCreate, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-slate-800 p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-base font-semibold">🏆 Tạo trận Chung kết</h2>
          <button onClick={onClose} className="text-slate-400" aria-label="Đóng">
            ✕
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-400">
          Hạng 1 và hạng 2 vòng bảng sẽ vào chung kết. Chọn luật chạm cho trận
          này:
        </p>

        <div className="grid grid-cols-2 gap-2">
          {RACE_TO_OPTIONS.map((raceTo) => (
            <button
              key={raceTo}
              onClick={() => onCreate(raceTo)}
              className="rounded-lg border border-slate-600 py-3 text-sm font-medium active:bg-sky-600 active:border-sky-600"
            >
              Chạm {raceTo}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
