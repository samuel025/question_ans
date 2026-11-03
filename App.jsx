import { useEffect, useMemo, useRef, useState } from 'react'

// Loads every batch file from the /batches folder in the project root.
// Adding batch-09.json etc. later needs no code change.
const files = import.meta.glob('/batches/batch-*.json', { eager: true })

const loaded = Object.keys(files)
  .sort()
  .flatMap((path) => files[path].default)

// Drop duplicate IDs (and warn) so one bad file cannot break the exam.
const seen = new Set()
const allQuestions = loaded.filter((q) => {
  if (seen.has(q.id)) {
    console.warn('Duplicate question id skipped:', q.id)
    return false
  }
  seen.add(q.id)
  return true
})

const KEY = 'fctirs-mock-history'
const COUNT_OPTIONS = [25, 50, 100, 'all']
const TIME_OPTIONS = [10, 15, 30, 45, 60, 90, 120] // minutes

function fmt(secs) {
  const s = Math.max(0, secs)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const mm = String(m).padStart(2, '0')
  const rr = String(r).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${rr}` : `${mm}:${rr}`
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    return []
  }
}

function saveHistory(h) {
  try {
    localStorage.setItem(KEY, JSON.stringify(h))
  } catch {}
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function App() {
  const [screen, setScreen] = useState('start')
  const [questions, setQuestions] = useState([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState([])
  const [history, setHistory] = useState(loadHistory)
  const [topic, setTopic] = useState('all')
  const [count, setCount] = useState(50)
  const [examTopic, setExamTopic] = useState('all')
  const [minutes, setMinutes] = useState(30)
  const [remaining, setRemaining] = useState(0)
  const [timedOut, setTimedOut] = useState(false)
  const endTime = useRef(0)
  const latest = useRef({ questions: [], answers: [], examTopic: 'all', history: [] })
  useEffect(() => {
    latest.current = { questions, answers, examTopic, history }
  })

  const topics = useMemo(
    () => [...new Set(allQuestions.map((q) => q.topic))],
    []
  )

  const pool = useMemo(
    () => (topic === 'all' ? allQuestions : allQuestions.filter((q) => q.topic === topic)),
    [topic]
  )

  const examSize = count === 'all' ? pool.length : Math.min(count, pool.length)

  function start(retakeSameSettings = false) {
    const t = retakeSameSettings ? examTopic : topic
    const p = t === 'all' ? allQuestions : allQuestions.filter((q) => q.topic === t)
    const size = count === 'all' ? p.length : Math.min(count, p.length)
    const qs = shuffle(p).slice(0, size)
    setExamTopic(t)
    setQuestions(qs)
    setIndex(0)
    setAnswers(qs.map(() => null))
    setTimedOut(false)
    endTime.current = Date.now() + minutes * 60 * 1000
    setRemaining(minutes * 60)
    setScreen('quiz')
  }

  function finish(auto = false) {
    const { questions: qs, answers: ans, examTopic: et, history: hist } = latest.current
    const score = ans.filter((a, i) => a === qs[i].answer).length
    const entry = {
      date: new Date().toLocaleString(),
      topic: et === 'all' ? 'All topics' : et,
      score,
      total: qs.length,
    }
    const h = [entry, ...hist].slice(0, 20)
    setHistory(h)
    saveHistory(h)
    setTimedOut(auto)
    setScreen('result')
  }

  function select(i) {
    setAnswers((prev) => prev.map((a, k) => (k === index ? i : a)))
  }

  function next() {
    if (index + 1 < questions.length) setIndex(index + 1)
    else finish(false)
  }

  useEffect(() => {
    if (screen !== 'quiz') return
    const tick = () => {
      const left = Math.ceil((endTime.current - Date.now()) / 1000)
      setRemaining(Math.max(0, left))
      if (left <= 0) finish(true)
    }
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [screen])

  function clearHistory() {
    setHistory([])
    saveHistory([])
  }

  if (screen === 'start') {
    return (
      <div className="container">
        <div className="card">
          <h1>FCTIRS Mock Exam</h1>
          <p className="muted">
            Assistant Director Tax promotion practice. {allQuestions.length} questions
            available across {topics.length} topics.
          </p>

          <label className="field">
            <span>Topic</span>
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="all">All topics ({allQuestions.length})</option>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t} ({allQuestions.filter((q) => q.topic === t).length})
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Number of questions</span>
            <select
              value={count}
              onChange={(e) =>
                setCount(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
            >
              {COUNT_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c === 'all' ? 'All in selection' : c}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Time limit</span>
            <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {TIME_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m >= 60 && m % 60 === 0 ? `${m / 60} hour${m > 60 ? 's' : ''}` : `${m} minutes`}
                </option>
              ))}
            </select>
          </label>

          <p className="muted">
            This exam: {examSize} questions, {minutes} minutes. It submits automatically when
            time runs out. Answers are shown at the end.
          </p>
          <button className="btn" onClick={() => start(false)} disabled={examSize === 0}>
            Start Exam
          </button>
        </div>

        {history.length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <h2>Past attempts</h2>
            {history.map((h, i) => (
              <div className="history-row" key={i}>
                <span>
                  {h.date}
                  {h.topic ? <span className="muted"> · {h.topic}</span> : null}
                </span>
                <strong>
                  {h.score}/{h.total}
                </strong>
              </div>
            ))}
            <button className="btn secondary" onClick={clearHistory}>
              Clear history
            </button>
          </div>
        )}
      </div>
    )
  }

  if (screen === 'result') {
    const score = answers.filter((a, i) => a === questions[i].answer).length
    const pct = Math.round((score / questions.length) * 100)
    return (
      <div className="container">
        <div className="card">
          <h1>Result</h1>
          {timedOut && <p className="muted">Time ran out - your exam was auto-submitted.</p>}
          <div className="score">
            {score}/{questions.length} ({pct}%)
          </div>

          <h2>Review</h2>
          {questions.map((q, i) => {
            const correct = answers[i] === q.answer
            return (
              <div key={q.id} style={{ marginBottom: 16 }}>
                <strong>
                  {i + 1}. {q.question}
                </strong>
                <div>
                  Your answer: {answers[i] === null ? 'None' : q.options[answers[i]]}{' '}
                  {correct ? '✅' : '❌'}
                </div>
                {!correct && <div>Correct: {q.options[q.answer]}</div>}
                <div className="muted">{q.explanation}</div>
                {q.source && <div className="muted source">Source: {q.source}</div>}
              </div>
            )
          })}

          <button className="btn" onClick={() => start(true)}>
            Retake
          </button>
          <button className="btn secondary" onClick={() => setScreen('start')}>
            Home
          </button>
        </div>
      </div>
    )
  }

  const q = questions[index]
  const selected = answers[index]
  const last = index + 1 === questions.length

  return (
    <div className="container">
      <div className="card">
        <div className="topbar">
          <span>
            Question {index + 1} of {questions.length}
          </span>
          <span className={`timer${remaining <= 60 ? ' low' : ''}`}>{fmt(remaining)}</span>
        </div>
        <div className="progress">
          <div
            className="progress-bar"
            style={{ width: `${(index / questions.length) * 100}%` }}
          />
        </div>

        <h2>{q.question}</h2>

        {q.options.map((opt, i) => (
          <button
            key={i}
            className={`option${i === selected ? ' selected' : ''}`}
            onClick={() => select(i)}
          >
            {String.fromCharCode(65 + i)}. {opt}
          </button>
        ))}

        <button className="btn secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          Previous
        </button>
        <button className="btn" onClick={next}>
          {last ? 'Submit' : 'Next'}
        </button>
      </div>
    </div>
  )
}
