/** Lets HTTP use cases end a live chat the same way the socket gateway does (partner notified). */
export interface ChatSessionControl {
  /** Ends the subject's session if it is the given one; does nothing otherwise. */
  endIfActive(subjectId: string, sessionId: string): Promise<void>;
}
