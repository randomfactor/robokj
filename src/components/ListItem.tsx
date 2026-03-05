export default function ListItem({ name, requestCount, onRemove, isPerforming }: { name: string, requestCount?: number, onRemove?: () => void, isPerforming?: boolean }) {
    return (
        <li className={`flex justify-between items-center p-2.5 bg-[#313244] rounded-md transition duration-200 hover:bg-[#45475a] hover:translate-x-1 cursor-pointer group ${isPerforming ? 'border-l-4 border-[#a6e3a1] bg-[#45475a]' : ''}`}>
            <span className={`flex-1 flex items-center gap-2 ${isPerforming ? 'font-bold text-[#a6e3a1]' : ''}`}>
                {isPerforming && <span title="Currently Performing">🎤</span>}
                {name}
            </span>
            <div className="flex items-center gap-2">
                {requestCount !== undefined && (
                    <span className={`font-bold text-xs bg-[#181825] px-2 py-0.5 rounded-full ${requestCount === 0 ? 'text-[#f38ba8]' : 'text-[#a6adc8]'}`}>
                        {`[${requestCount}]`}
                    </span>
                )}
                {onRemove && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                        className="text-[#f38ba8] hover:text-[#eba0ac] transition-colors p-1 rounded hover:bg-[#181825]"
                        title="Remove Singer"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                    </button>
                )}
            </div>
        </li>
    );
}
