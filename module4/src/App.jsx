import { useState } from 'react';
import './index.css';

const SLIDES = [
  { id: 'placeholder', type: 'text', title: 'Module 4 — coming up', body: 'Slides land in Task 2.1.' },
];

export default function App() {
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];
  return (
    <div className="app">
      <header>{slide.title}</header>
      <main>{slide.body}</main>
      <footer>
        <button disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Prev</button>
        <span>{idx + 1} / {SLIDES.length}</span>
        <button disabled={idx === SLIDES.length - 1} onClick={() => setIdx(idx + 1)}>Next</button>
      </footer>
    </div>
  );
}
