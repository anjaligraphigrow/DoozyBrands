import { useEffect, useRef, useState } from "react";
import EmojiPicker, { EmojiStyle } from "emoji-picker-react";

import {
  deleteMessagesForUser,
  deleteSelectedMessages,
  getConversation,
  getUnreadMessageCountForUser,
  markMessagesRead,
  sendMessage,
  callEmployeeToCabin,
} from "../api/message";

import TrashIcon from "../components/TrashIcon";
import { getUsers } from "../api/users";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../utils/errors";

import type { Employee, Message } from "../types";

export default function Messages() {
  const { user } = useAuth();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedUserId, setSelectedUserId] =
    useState<number | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [selectedMessageIds, setSelectedMessageIds] = useState<number[]>([]);
  const [isSelectingMessages, setIsSelectingMessages] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState("");

  const selectedEmployee = employees.find(
    (employee) => employee.id === selectedUserId,
  );

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageInputRef = useRef<HTMLDivElement | null>(null);
  const composerSelectionRef = useRef<Range | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  useEffect(() => {
    async function loadUsers() {
      try {
        setLoadingUsers(true);
        setError("");

        const data = await getUsers();
        setEmployees(data);

        const unreadMap: Record<number, number> = {};

        for (const employee of data) {
          unreadMap[employee.id] = await getUnreadMessageCountForUser(employee.id);
        }

        setUnreadCounts(unreadMap);
      } catch (err: unknown) {
        setError(
          getErrorMessage(err, "Unable to load users."),
        );
      } finally {
        setLoadingUsers(false);
      }
    }

    if (user) {
      loadUsers();
    }
  }, [user]);

  useEffect(() => {
    async function loadConversation() {
      if (!selectedUserId) {
        setMessages([]);
        setSelectedMessageIds([]);
        setIsSelectingMessages(false);
        return;
      }

      setLoadingMessages(true);
      setError("");
      setSelectedMessageIds([]);
      setIsSelectingMessages(false);

      try {
        const data = await getConversation(selectedUserId);

        setMessages(data);

        await markMessagesRead(selectedUserId);
        setUnreadCounts((current) => ({ ...current, [selectedUserId]: 0 }));
        window.dispatchEvent(new Event("office-badges-refresh"));
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Unable to load conversation."));
      } finally {
        setLoadingMessages(false);
      }
    }

    loadConversation();
  }, [selectedUserId]);

  useEffect(() => {
    function refreshSenderUnreadCount(event: Event) {
      const senderId = (event as CustomEvent<{ senderId?: number }>).detail?.senderId;

      if (!senderId) {
        return;
      }

      getUnreadMessageCountForUser(senderId)
        .then((count) => {
          setUnreadCounts((current) => ({ ...current, [senderId]: count }));
        })
        .catch(() => undefined);
    }

    window.addEventListener("office-incoming-message", refreshSenderUnreadCount);
    return () =>
      window.removeEventListener("office-incoming-message", refreshSenderUnreadCount);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const trimmed = messageText.trim();

    if (!selectedUserId || !trimmed || sending) {
      return;
    }

    setSending(true);
    setError("");

    try {
      const newMessage = await sendMessage(
        selectedUserId,
        trimmed,
      );

      setMessages((current) => [
        ...current,
        newMessage,
      ]);

      setMessageText("");
      if (messageInputRef.current) {
        messageInputRef.current.replaceChildren();
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to send message."));
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (!sending && selectedUserId) {
      messageInputRef.current?.focus();
    }
  }, [sending, selectedUserId]);

  function serializeComposer(node: Node): string {
    return Array.from(node.childNodes).map((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        return child.textContent ?? "";
      }

      if (
        child instanceof HTMLElement &&
        child.dataset.emojiUnified
      ) {
        return `[[apple-emoji:${child.dataset.emojiUnified}]]`;
      }

      return serializeComposer(child);
    }).join("");
  }

  function rememberComposerSelection() {
    const selection = window.getSelection();

    if (
      selection &&
      selection.rangeCount > 0 &&
      messageInputRef.current?.contains(selection.anchorNode)
    ) {
      composerSelectionRef.current = selection.getRangeAt(0).cloneRange();
    }
  }

  function insertEmoji(emoji: string, unified: string) {
    const input = messageInputRef.current;
    if (!input) {
      return;
    }

    input.focus();
    const selection = window.getSelection();
    const range = composerSelectionRef.current ?? document.createRange();

    if (!composerSelectionRef.current) {
      range.selectNodeContents(input);
      range.collapse(false);
    }

    range.deleteContents();

    const image = document.createElement("img");
    image.className = "message-composer-emoji";
    image.src = `https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${unified}.png`;
    image.alt = emoji;
    image.dataset.emojiUnified = unified;
    range.insertNode(image);
    range.setStartAfter(image);
    range.collapse(true);

    selection?.removeAllRanges();
    selection?.addRange(range);
    composerSelectionRef.current = range.cloneRange();
    setMessageText(serializeComposer(input));
    setShowEmojiPicker(false);
  }

  function renderMessage(message: string) {
    const parts = message.split(/(\[\[apple-emoji:[0-9a-f-]+\]\])/gi);

    return parts.map((part, index) => {
      const match = part.match(/^\[\[apple-emoji:([0-9a-f-]+)\]\]$/i);

      if (!match) {
        return <span key={index}>{part}</span>;
      }

      return (
        <img
          key={index}
          className="message-apple-emoji"
          src={`https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${match[1]}.png`}
          alt="emoji"
        />
      );
    });
  }

  async function handleCallEmployee() {
    if (!selectedUserId || calling) {
      return;
    }

    setCalling(true);
    setError("");

    try {
      await callEmployeeToCabin(selectedUserId);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to call employee."));
    } finally {
      setCalling(false);
    }
  }

  function toggleMessageSelection(messageId: number) {
    setSelectedMessageIds((current) =>
      current.includes(messageId)
        ? current.filter((id) => id !== messageId)
        : [...current, messageId],
    );
  }

  async function handleDeleteSelectedMessages() {
    if (!selectedMessageIds.length) {
      return;
    }

    if (!window.confirm(`Delete ${selectedMessageIds.length} selected message(s)?`)) {
      return;
    }

    setError("");

    try {
      await deleteSelectedMessages(selectedMessageIds);
      setMessages((current) =>
        current.filter((message) => !selectedMessageIds.includes(message.id)),
      );
      setSelectedMessageIds([]);
      window.dispatchEvent(new Event("office-badges-refresh"));
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to delete selected messages."));
    }
  }

  async function handleDeleteConversation(userId: number) {
    if (!userId || !window.confirm("Delete this conversation permanently?")) {
      return;
    }

    setError("");

    try {
      await deleteMessagesForUser(userId);

      if (selectedUserId === userId) {
        setMessages([]);
      }

      setSelectedMessageIds([]);
      setUnreadCounts((current) => ({ ...current, [userId]: 0 }));
      window.dispatchEvent(new Event("office-badges-refresh"));
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to delete messages."));
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">DoozyBrands</p>
          <h2>Messages</h2>
          <p>Send and receive messages with employees.</p>
        </div>
      </header>

      {error && (
        <div className="page-error">
          {error}
        </div>
      )}

      <div className="messages-layout">
        <aside className="messages-users">
          <h3>Employees</h3>

          {loadingUsers ? (
            <div className="page-loading">
              Loading employees...
            </div>
          ) : employees.length === 0 ? (
            <div className="empty-state">
              No other employees found.
            </div>
          ) : (
            employees.map((employee) => {
              const unreadCount = unreadCounts[employee.id] ?? 0;

              return (
                <button
                  key={employee.id}
                  type="button"
                  className={
                    selectedUserId === employee.id
                      ? "message-user active"
                      : "message-user"
                  }
                  onClick={() =>
                    setSelectedUserId(employee.id)
                  }
                >
                  <span className="message-user-main">
                    <strong>{employee.name}</strong>
                    {unreadCount > 0 && (
                      <span
                        className="message-user-badge"
                        aria-label={`${unreadCount} unread messages`}
                        title={`${unreadCount} unread messages`}
                      >
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </aside>

        <section className="messages-panel">
          {!selectedUserId ? (
            <div className="empty-state">
              <h3>Select an employee</h3>
              <p>
                Choose an employee to open the conversation.
              </p>
            </div>
          ) : (
            <>
              <div className="messages-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <h3>
                  {
                    employees.find(
                      (employee) =>
                        employee.id === selectedUserId,
                    )?.name
                  }
                </h3>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setIsSelectingMessages((current) => !current);
                      setSelectedMessageIds([]);
                    }}
                    style={{
                      minWidth: 72,
                      padding: "7px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {isSelectingMessages ? "Cancel" : "Select"}
                  </button>

                  {isSelectingMessages && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={handleDeleteSelectedMessages}
                      disabled={selectedMessageIds.length === 0}
                      aria-label="Delete selected messages"
                      title="Delete selected messages"
                      style={{
                        minWidth: 42,
                        padding: "7px 10px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#1f2937",
                      }}
                    >
                      <TrashIcon size={18} />
                    </button>
                  )}

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleDeleteConversation(selectedUserId)}
                    aria-label="Delete conversation"
                    title="Delete conversation"
                    style={{
                      minWidth: 42,
                      padding: "7px 10px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#1f2937",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        fontSize: 20,
                        lineHeight: 1,
                        fontWeight: 700,
                      }}
                    >
                      X
                    </span>
                  </button>
                </div>
              </div>

              <div className="messages-list">
                {loadingMessages ? (
                  <div className="page-loading">
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="empty-state">
                    <p>No messages yet. Say hello!</p>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={
                          message.sender_id === user?.id
                            ? "message-bubble sent"
                            : "message-bubble received"
                        }
                        style={{ position: "relative" }}
                      >
                        {isSelectingMessages && (
                          <label
                            style={{
                              position: "absolute",
                              top: 8,
                              left: 8,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedMessageIds.includes(message.id)}
                              onChange={() => toggleMessageSelection(message.id)}
                            />
                          </label>
                        )}

                        <div style={{ paddingLeft: isSelectingMessages ? 28 : 0 }}>
                          <p>{renderMessage(message.message)}</p>

                          <small>
                            {new Date(
                              message.created_at,
                            ).toLocaleString()}
                          </small>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              <div className="message-compose">
                <div
                  ref={messageInputRef}
                  className="message-composer-input"
                  contentEditable
                  role="textbox"
                  aria-multiline="true"
                  data-placeholder="Type a message..."
                  onInput={(event) => {
                    setMessageText(serializeComposer(event.currentTarget));
                    rememberComposerSelection();
                  }}
                  onBlur={rememberComposerSelection}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                />

                <div className="message-compose-actions">
                  <div className="emoji-picker-wrapper">
                    <button
                      type="button"
                      className="icon-button emoji-button"
                      onClick={() => setShowEmojiPicker((current) => !current)}
                      disabled={sending}
                      aria-label="Open emoji keyboard"
                      title="Open emoji keyboard"
                      aria-expanded={showEmojiPicker}
                    >
                      😄
                    </button>

                    {showEmojiPicker && (
                      <div className="emoji-picker-popup">
                        <EmojiPicker
                          onEmojiClick={(emojiData) =>
                            insertEmoji(emojiData.emoji, emojiData.unified)
                          }
                          emojiStyle={EmojiStyle.APPLE}
                          width={320}
                          height={380}
                          previewConfig={{ showPreview: false }}
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleSend}
                    disabled={
                      sending || !messageText.trim()
                    }
                  >
                    {sending ? "Sending..." : "Send"}
                  </button>

                  {user?.role === "admin" &&
                    selectedEmployee?.role === "employee" && (
                    <button
                      type="button"
                      className="icon-button manager-call-button"
                      onClick={handleCallEmployee}
                      disabled={calling}
                      aria-label="Call employee to Sir's Cabin"
                      title="Call employee to Sir's Cabin"
                    >
                      {calling ? "…" : "🔔"}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
