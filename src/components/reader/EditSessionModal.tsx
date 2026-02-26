'use client';

interface EditSessionModalProps {
  visible: boolean;
  title: string;
  onTitleChange: (title: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function EditSessionModal({
  visible,
  title,
  onTitleChange,
  onSave,
  onClose,
}: EditSessionModalProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-80 max-w-[90vw]">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">重命名对话</h3>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSave();
            } else if (e.key === 'Escape') {
              onClose();
            }
          }}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="输入新名称..."
          autoFocus
        />
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
