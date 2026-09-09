import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import logo from '../images/logo-large.svg';
import assignmentImage from '../../img/assignment.svg';
import timelineImage from '../../img/timeline.svg';
import superviseImage from '../../img/supervise.svg';
import reviewImage from '../../img/review.svg';
import { persistOnboardingStatus } from '../utils/onboarding.ts';

interface Slide { title: string; body: string; description: string; kind: 'welcome' | 'plan' | 'delegate' | 'supervise' | 'review'; image?: string; }
const slides: Slide[] = [
  { title: 'Welcome to Omvra', body: 'Plan the work, delegate it to an agent, supervise progress, and review the outcome.', description: 'The Omvra workflow: Plan, Delegate, Supervise, Review.', kind: 'welcome' },
  { title: 'Plan the work', body: 'Use the Timeline to shape dates and dependencies, or Swimlanes to organize tasks by status. Projects keep the work in context.', description: 'A Product launch project contains a Prepare launch brief task on the Timeline and in Swimlanes.', kind: 'plan', image: timelineImage },
  { title: 'Delegate with intent', body: 'Assign a task to an agent whose persona and operational instructions match the work. The task stays the source of truth for what needs to happen.', description: 'An assigned task connects the work request to an agent profile with persona and operational instructions.', kind: 'delegate', image: assignmentImage },
  { title: 'Supervise the work', body: 'Choose Start work from the task. Omvra checks the assignee, working folder, model, and task instructions, then shows agent activity and blockers.', description: 'The Start work panel confirms task context and shows agent activity while work is in progress.', kind: 'supervise', image: superviseImage },
  { title: 'Review the outcome', body: 'When work is ready for review, inspect the result and context history. Move the task forward when it is ready, or return it with guidance.', description: 'A task in Under Review presents its outcome and context history for a human decision.', kind: 'review', image: reviewImage },
];

function IllustratedPanel({ kind, image }: { kind: Slide['kind']; image?: string }) {
  if (kind === 'welcome') return <div className="omvra-onboarding-welcome-mark" aria-hidden="true"><img src={logo} alt="" /><span>Plan · Delegate · Supervise · Review</span></div>;
  return <div className="omvra-onboarding-asset" aria-hidden="true"><img src={image} alt="" /></div>;
}

export function OnboardingDialog({ open, onClose, onStartFirstTask }: { open: boolean; onClose: () => void; onStartFirstTask: () => void }) {
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    setIndex(0);
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); void persistOnboardingStatus('dismissed'); onClose(); }
      if (event.key === 'ArrowRight') setIndex(value => Math.min(slides.length - 1, value + 1));
      if (event.key === 'ArrowLeft') setIndex(value => Math.max(0, value - 1));
      if (event.key === 'Tab') {
        const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? []);
        if (!focusable.length) return;
        const current = focusable.indexOf(document.activeElement as HTMLElement);
        const next = focusable[(current + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length];
        if (current === -1 || (!event.shiftKey && current === focusable.length - 1) || (event.shiftKey && current === 0)) { event.preventDefault(); next.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const previousFocus = previousFocusRef.current;
      const focusTarget = previousFocus?.isConnected && previousFocus !== document.body
        ? previousFocus
        : document.querySelector<HTMLElement>('[aria-label="Open preferences"]');
      window.requestAnimationFrame(() => { if (focusTarget?.isConnected) focusTarget.focus(); });
    };
  }, [open, onClose]);
  if (!open) return null;
  const slide = slides[index];
  const finish = () => { void persistOnboardingStatus(index === slides.length - 1 ? 'completed' : 'dismissed'); onClose(); };
  const startFirstTask = () => { void persistOnboardingStatus('dismissed'); onClose(); onStartFirstTask(); };
  return <div className="omvra-onboarding-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) finish(); }}>
    <section ref={dialogRef} className="omvra-onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="omvra-onboarding-title" aria-describedby="omvra-onboarding-body">
      <button ref={closeButtonRef} type="button" className="omvra-onboarding-close" aria-label="Close onboarding" onClick={finish}><X size={18} /></button>
      <div className="omvra-onboarding-gradient" aria-hidden="true" />
      <div className="omvra-onboarding-content"><div className="omvra-onboarding-visual"><IllustratedPanel kind={slide.kind} image={slide.image} /><p className="sr-only">{slide.description}</p></div><div className="omvra-onboarding-copy"><h2 id="omvra-onboarding-title">{slide.title}</h2><p id="omvra-onboarding-body">{slide.body}</p>{index === 0 && <div className="omvra-onboarding-welcome-actions"><button type="button" className="omvra-onboarding-start omvra-onboarding-primary" onClick={startFirstTask}><RocketIcon /> Get started</button></div>}</div></div>
      <footer className="omvra-onboarding-footer"><button type="button" className="omvra-onboarding-secondary" onClick={() => setIndex(value => Math.max(0, value - 1))} disabled={index === 0}><ArrowLeft size={15} /> Back</button><div style={{ visibility: index === 0 ? 'hidden' : undefined }} className="omvra-onboarding-progress" aria-label={`Slide ${index + 1} of ${slides.length}`}>{slides.map((item, itemIndex) => <span key={item.title} className={itemIndex === index ? 'is-active' : ''} />)}</div><div className="omvra-onboarding-actions">{index === 0 ? <button type="button" className="omvra-onboarding-secondary" onClick={() => setIndex(1)}>Take a tour <ArrowRight size={15} /></button> : index === slides.length - 1 ? <button type="button" className="omvra-onboarding-primary" onClick={finish}><Check size={15} /> Done</button> : <button type="button" className="omvra-onboarding-primary" onClick={() => setIndex(value => value + 1)}>Next <ArrowRight size={15} /></button>}</div></footer>
    </section>
  </div>;
}

function RocketIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
    <g fill="currentColor">
      <path d="M13.1707 10.0588C16.6759 6.381 16.2472 2.0942 16.2108 1.7892C15.9049 1.7528 11.619 1.3241 7.94118 4.8293C5.71338 6.9526 4.96349 9.3233 4.74579 10.1164L7.88368 13.2543C8.67678 13.0366 11.0474 12.2865 13.1707 10.0588Z" fillOpacity=".3" />
      <path d="M11.75 7.5C12.44 7.5 13 6.9404 13 6.25C13 5.5596 12.44 5 11.75 5C11.06 5 10.5 5.5596 10.5 6.25C10.5 6.9404 11.06 7.5 11.75 7.5Z" />
    </g>
    <g stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M2.85699 12.4692C2.20309 12.7981 1.75 13.468 1.75 14.25V16.25H3.75C4.5317 16.25 5.2016 15.7971 5.5305 15.1433" />
      <path d="M13.1707 10.0588C16.6759 6.381 16.2472 2.0942 16.2108 1.7892C15.9049 1.7528 11.619 1.3241 7.94118 4.8293C5.71338 6.9526 4.96349 9.3233 4.74579 10.1164L7.88368 13.2543C8.67678 13.0366 11.0474 12.2865 13.1707 10.0588Z" />
      <path d="M8.26601 4.5279L6.892 4.2819C5.637 4.0569 4.737 3.959 4 5L1.75 8.2699C1.75 8.2699 3.3528 7.6568 5.5921 7.9669" />
      <path d="M10.033 12.4078C10.3431 14.647 9.72998 16.2499 9.72998 16.2499L13 14C14.041 13.263 13.943 12.3629 13.718 11.1079L13.472 9.7339" />
    </g>
  </svg>;
}
