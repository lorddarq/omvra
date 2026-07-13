const faqs = [
  {
    question: 'Where does Omvra store my workspace?',
    answer:
      'On your computer. Tasks, projects, people, boards, roadmap data, and preferences stay in Omvra’s local app storage, so you do not need an account or cloud workspace.',
  },
  {
    question: 'Does Omvra work offline?',
    answer:
      'Yes. You can plan, edit tasks, and manage your workspace without an internet connection. Checking for updates, opening online links, or working with a remote agent still requires a connection.',
  },
  {
    question: 'Does Omvra send my workspace data anywhere?',
    answer:
      'Not during normal planning and task management. Network access only happens when you choose an online action, such as checking for updates, opening an external link, or connecting an MCP client.',
  },
  {
    question: 'Can I use Omvra for sensitive or regulated work?',
    answer:
      'Omvra keeps normal planning data on your computer and does not require a hosted workspace. That can help teams with strict privacy requirements, but your organization still needs to evaluate device security, backups, access controls, and approved AI connections for its own policies.',
  },
  {
    question: 'How do AI agents access Omvra?',
    answer:
      'Through Omvra’s built-in MCP server. Agent access stays off until you enable it, and you can use a local HTTP or stdio connection with an optional token. Stop the server or disable access whenever you want.',
  },
  {
    question: 'What can an agent read or change?',
    answer:
      'You decide. Read Only lets an agent inspect workspace data without changing it. Task Write adds safe task and roadmap actions. Admin provides the broadest available access. Start with Read Only and increase access only when the work requires it.',
  },
  {
    question: 'Can I back up and restore everything?',
    answer:
      'Yes. A full JSON backup can include tasks, people, projects, boards, roadmap data, preferences, and MCP settings. Create one from Settings → Data, and use Restore in the same place when you need it.',
  },
  {
    question: 'Can I move my workspace to another computer?',
    answer:
      'Yes. Create a backup on the first computer, copy the JSON file, then restore it on the new computer. Move attached files separately because Omvra stores links to those files rather than copying them into the backup.',
  },
  {
    question: 'What happens to attached files?',
    answer:
      'Omvra keeps a reference to each file at its original location. Attachment details survive backup and restore, but moving or deleting the original file means Omvra can no longer find it.',
  },
  {
    question: 'What is the difference between Kanban and Timeline?',
    answer:
      'Kanban shows where work stands. Timeline shows when scheduled work happens. Both views use the same tasks, so you can move work through statuses in Kanban and plan dates and duration on the Timeline without maintaining two separate plans.',
  },
  {
    question: 'Why might a task be missing from the Timeline?',
    answer:
      'The task may not have a Timeline Project, completed work may be hidden, or you may be viewing the Timeline by People while the task has no assignee. Check those three settings first.',
  },
  {
    question: 'How do I update Omvra?',
    answer:
      'Open Settings → About, choose Stable releases or Release candidates, then check for updates. Stable releases are the safer default. Omvra asks for a fresh backup before installing a release candidate.',
  },
  {
    question: 'Why can’t my agent connect to MCP?',
    answer:
      'Check that agent access is enabled and the MCP listener is running. Make sure the agent uses the current address, port, and token. Restart the listener after changing any of those settings, then run the built-in health check if the connection still fails.',
  },
  {
    question: 'Why are MCP write tools missing?',
    answer:
      'The MCP listener is probably using Read Only access. Choose Task Write or Admin, restart the listener, and reconnect the agent. Task Write is the better default when the agent only needs to update work.',
  },
  {
    question: 'Where can I ask for help or report a problem?',
    answer:
      'Use Suggestions & feedback in Settings → About, or open an issue on GitHub. Include your Omvra version, operating system, what you expected, and what happened—but remove access tokens and private workspace details before sharing logs or screenshots.',
  },
] as const

const Faq = () => {
  return (
    <section id="faq" className="bg-[#fbfaf8] pb-24 md:pb-28">
      <div className="landing-container">
        <div className="mx-auto max-w-[72rem] border-t border-black/8 pt-14 md:pt-16">
          <div className="mx-auto max-w-3xl text-center">
              <p className="text-[0.72rem] font-medium uppercase tracking-[0.22em] text-[#8f8b93]">
                Frequently asked questions
              </p>
              <h2 className="mt-5 text-balance text-[clamp(2.9rem,5vw,4rem)] font-medium leading-[1.04] tracking-[-0.05em] text-[#5b5966]">
                Good to know before you start
              </h2>
              <p className="mx-auto mt-7 max-w-[36rem] text-pretty text-lg leading-9 text-[#6d6a73] sm:text-[1.35rem]">
                The practical details about local data, backups, planning, and working with agents.
              </p>
          </div>

          <div className="mx-auto mt-16 max-w-[72rem] border-t border-black/10">
              {faqs.map((faq) => (
                <details key={faq.question} className="group border-b border-black/10">
                  <summary className="flex min-h-20 cursor-pointer list-none items-center gap-6 py-5 text-left outline-none transition-colors duration-150 hover:text-[#2f2e35] focus-visible:ring-2 focus-visible:ring-black/10 focus-visible:ring-offset-4 focus-visible:ring-offset-[#fbfaf8] [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1 text-lg font-medium leading-7 text-[#5b5966] sm:text-xl">
                      {faq.question}
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      aria-hidden="true"
                      className="size-5 shrink-0 text-[#8f8b93] transition-transform duration-200 group-open:rotate-45"
                    >
                      <path d="M12 5v14M5 12h14" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </summary>
                  <div className="w-full max-w-none pb-8 pr-12 text-lg leading-9 text-[#77737c] md:pr-20 sm:text-xl">
                    <p>{faq.answer}</p>
                  </div>
                </details>
              ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default Faq
