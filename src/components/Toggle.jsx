export default function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{ backgroundColor: checked ? '#FECD28' : undefined }}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none
        ${!checked ? 'bg-slate-200' : ''}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full shadow transform transition-transform duration-200
          ${checked ? 'translate-x-4 bg-[#111111]' : 'translate-x-0 bg-white'}`}
      />
    </button>
  )
}
