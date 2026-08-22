import React, { useEffect, useState } from 'react'
import GlassPanel from '@/components/GlassPanel'
import { api } from '@/lib/api'
import { Plus, Trash2, Upload, RotateCcw, GraduationCap } from 'lucide-react'

/* Learning — SRS flashcards (simplified SM-2 on the Go side).
 * Review flow: front → reveal → grade (again / hard / good / easy). */

const GRADES = [
  { g: 0, label: '忘了', cls: 'text-sig-error border-sig-error' },
  { g: 1, label: '困难', cls: 'text-sig-warn border-sig-warn' },
  { g: 2, label: '良好', cls: 'text-accent border-accent' },
  { g: 3, label: '简单', cls: 'text-emerald-700 border-emerald-600' },
]

export const Learning: React.FC = () => {
  const [decks, setDecks] = useState<any[]>([])
  const [cur, setCur] = useState<string | null>(null)
  const [cards, setCards] = useState<any[]>([])
  const [dueOnly, setDueOnly] = useState(true)
  const [cardForm, setCardForm] = useState({ front: '', back: '' })
  const [deckName, setDeckName] = useState('')
  const [importPath, setImportPath] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [done, setDone] = useState(0)

  const loadDecks = async () => setDecks(await api.learning.decks() ?? [])
  const loadCards = async () => {
    if (!cur) { setCards([]); return }
    setCards(await api.learning.cards(cur, dueOnly) ?? [])
  }
  useEffect(() => { loadDecks() }, [])
  useEffect(() => { loadCards() }, [cur, dueOnly])

  const addDeck = async () => {
    if (!deckName.trim()) return
    const d = await api.learning.saveDeck(deckName)
    setDeckName('')
    await loadDecks()
    if (d?.id) setCur(d.id)
  }
  const addCard = async () => {
    if (!cur || !cardForm.front || !cardForm.back) return
    await api.learning.saveCard({ ...cardForm, deck_id: cur })
    setCardForm({ front: '', back: '' })
    loadCards(); loadDecks()
  }
  const doImport = async () => {
    if (!cur || !importPath) return
    const n = await api.learning.importFile(cur, importPath)
    setImportPath('')
    loadCards(); loadDecks()
    alert(`导入 ${n} 张卡片`)
  }

  const startReview = async () => { setReviewing(true); setIdx(0); setRevealed(false); setDone(0); loadCards() }
  const grade = async (g: number) => {
    const c = cards[idx]
    if (!c) return
    await api.learning.review(c.id, g)
    setDone(d => d + 1)
    setRevealed(false)
    if (idx + 1 >= cards.length) { setReviewing(false); loadDecks(); loadCards() }
    else setIdx(idx + 1)
  }

  const curDeck = decks.find(d => d.id === cur)

  return (
    <div className="p-6 space-y-4">
      <GlassPanel title="LEARNING · 学习" subtitle="SM-2 间隔重复 · 复习奖励 XP · JSON/CSV 导入" />

      {/* review mode */}
      {reviewing && cards[idx] ? (
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between text-xs pt-mono text-text-lo mb-2">
            <span>{idx + 1} / {cards.length}</span>
            <span>已完成 {done}</span>
            <button className="pt-btn pt-btn-ghost text-xs" onClick={() => setReviewing(false)}>退出</button>
          </div>
          <div className="border border-accent/50 bg-surface p-10 text-center min-h-[220px] flex flex-col justify-center">
            <div className="text-2xl text-text-hi">{cards[idx].front}</div>
            {revealed ? (
              <div className="mt-6 pt-6 border-t border-edge text-lg text-accent">{cards[idx].back}</div>
            ) : (
              <button className="pt-btn pt-btn-primary mt-8 self-center" onClick={() => setRevealed(true)}>
                显示答案（空格）
              </button>
            )}
          </div>
          {revealed && (
            <div className="grid grid-cols-4 gap-2 mt-3">
              {GRADES.map(g => (
                <button key={g.g} className={`pt-btn border text-xs ${g.cls}`} onClick={() => grade(g.g)}>
                  {g.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-[280px_1fr] gap-3">
          {/* decks */}
          <div className="space-y-2">
            <div className="border border-edge p-3 space-y-2">
              <div className="pt-section-label text-text-lo flex items-center gap-1.5">
                <GraduationCap size={12} /> NEW DECK
              </div>
              <input className="pt-input w-full pt-mono text-xs" placeholder="牌组名 *（如：雅思核心词）"
                value={deckName} onChange={e => setDeckName(e.target.value)} />
              <button className="pt-btn pt-btn-primary w-full text-xs" onClick={addDeck}><Plus size={12} /> 创建</button>
            </div>
            {decks.map(d => (
              <div key={d.id}
                className={['border px-3 py-2 cursor-pointer transition-colors',
                  cur === d.id ? 'border-accent bg-surface' : 'border-edge hover:border-accent/50'].join(' ')}
                onClick={() => setCur(d.id)}>
                <div className="flex items-center justify-between">
                  <span className="text-sm truncate">{d.name}</span>
                  <button className="text-sig-error hover:text-red-400 shrink-0"
                    onClick={async e => { e.stopPropagation(); await api.learning.deleteDeck(d.id); if (cur === d.id) setCur(null); loadDecks() }}>
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="text-xs text-text-lo pt-mono mt-0.5">
                  {d.total} 张 · <span className="text-accent">{d.due} 待复习</span>
                </div>
              </div>
            ))}
          </div>

          {/* cards */}
          <div className="space-y-3">
            {cur ? (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <button className="pt-btn pt-btn-primary text-xs" onClick={startReview}>
                    <RotateCcw size={12} /> 开始复习（{dueOnly ? `${curDeck?.due ?? 0} 张到期` : '全部'}）
                  </button>
                  <button className={['pt-btn', 'text-xs', dueOnly ? 'pt-btn-primary' : 'pt-btn-ghost'].join(' ')}
                    onClick={() => setDueOnly(!dueOnly)}>
                    {dueOnly ? '只看到期' : '显示全部'}
                  </button>
                  <span className="text-xs text-text-lo pt-mono">{cards.length} 张</span>
                </div>

                <div className="border border-edge p-3 space-y-2">
                  <div className="pt-section-label text-text-lo">ADD CARD</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input className="pt-input pt-mono text-xs" placeholder="正面 *（问题/单词）"
                      value={cardForm.front} onChange={e => setCardForm({ ...cardForm, front: e.target.value })} />
                    <input className="pt-input pt-mono text-xs" placeholder="背面 *（答案/释义）"
                      value={cardForm.back} onChange={e => setCardForm({ ...cardForm, back: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && addCard()} />
                  </div>
                  <button className="pt-btn pt-btn-primary text-xs" onClick={addCard}><Plus size={12} /> 添加</button>
                </div>

                <div className="border border-edge p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="pt-section-label text-text-lo">IMPORT · JSON [{front,back}] / CSV</div>
                  </div>
                  <div className="flex gap-2">
                    <input className="pt-input flex-1 pt-mono text-xs" placeholder="文件绝对路径"
                      value={importPath} onChange={e => setImportPath(e.target.value)} />
                    <button className="pt-btn text-xs" onClick={doImport}><Upload size={12} /> IMPORT</button>
                  </div>
                </div>

                <div className="space-y-1 max-h-[340px] overflow-auto">
                  {cards.map(c => (
                    <div key={c.id} className="flex items-center gap-3 border border-edge px-3 py-1.5 text-xs group">
                      <span className="flex-1 truncate">{c.front}</span>
                      <span className="text-text-lo">↔</span>
                      <span className="flex-1 truncate text-text-mid">{c.back}</span>
                      <span className="pt-mono text-[10px] text-text-lo shrink-0">
                        r{c.reps} · e{Number(c.ease).toFixed(1)}
                        {c.due_at <= Date.now() / 1000 && <span className="text-accent"> · DUE</span>}
                      </span>
                      <button className="text-sig-error opacity-0 group-hover:opacity-100 shrink-0"
                        onClick={async () => { await api.learning.deleteCard(c.id); loadCards(); loadDecks() }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="border border-edge p-8 text-center text-text-lo text-xs">左侧创建或选择一个牌组</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Learning
