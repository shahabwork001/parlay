"use client";

import { type FormEvent, type KeyboardEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const MAX_LENGTH = 1000;

interface ComposerProps {
  disabled: boolean;
  onSend: (text: string) => void;
  onTyping: () => void;
}

/** Enter sends, Shift+Enter adds a new line. */
export function Composer({ disabled, onSend, onTyping }: ComposerProps) {
  const [text, setText] = useState("");

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (disabled || !text.trim()) return;
    onSend(text);
    setText("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <label htmlFor="chat-message" className="sr-only">
        Message
      </label>
      <Textarea
        id="chat-message"
        value={text}
        disabled={disabled}
        maxLength={MAX_LENGTH}
        rows={1}
        placeholder={disabled ? "Waiting for someone to chat with" : "Type a message"}
        className="max-h-32 min-h-10 resize-none"
        onChange={(event) => {
          setText(event.target.value);
          onTyping();
        }}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      <Button type="submit" size="lg" disabled={disabled || !text.trim()} className="h-10">
        Send
      </Button>
    </form>
  );
}
