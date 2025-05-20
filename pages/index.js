import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import styles from '../styles/Home.module.css';
import config from '../templates/bot-config';

const STORAGE_KEY = 'chat_history';
const INACTIVITY_TIMEOUT = 120000; // 2 minutes
const TRIGGER_KEYWORDS = ['gracias', 'adios', 'agu', 'bien'];

export default dynamic(
  () => Promise.resolve(Home),
  { ssr: false }
);

function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const [showRatingPrompt, setShowRatingPrompt] = useState(false);
  const chatContainerRef = useRef(null);
  const inactivityTimer = useRef(null);

  // Only run on client
  useEffect(() => {
    // load from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved));
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }

    // initialize thread
    fetch('/api/init-thread')
      .then(res => res.json())
      .then(data => {
        setThreadId(data.threadId);
        if (messages.length === 0) {
          setMessages([{ role: 'assistant', content: config.welcomeMessage }]);
        }
      })
      .catch(() => {
        setMessages([{ role: 'assistant', content: config.errorMessage }]);
      });
  }, []);

  // Persist messages
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    resetInactivityTimer();
  }, [messages]);

  // Scroll
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const resetInactivityTimer = () => {
    clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      triggerRating();
    }, INACTIVITY_TIMEOUT);
  };

  const triggerRating = () => {
    if (!showRatingPrompt && messages.length) {
      setShowRatingPrompt(true);
      addRatingMessage();
    }
  };

  const addRatingMessage = () => {
    const msg = {
      role: 'assistant',
      content: `Agradeceríamos mucho que evaluara nuestro servicio：<a href="${config.ratingUrl}" target="_blank" rel="noopener noreferrer">点击这里评价</a>`,
      isRating: true
    };
    setMessages(prev => [...prev, msg]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, threadId })
      });
      const data = await res.json();
      if (data.reply) setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: config.errorMessage }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={styles.container}
      style={{
        '--color-primary': config.cssConfig.primaryColor,
        '--color-secondary': config.cssConfig.secondaryColor,
        '--message-radius': config.cssConfig.messageRadius,
        '--input-radius': config.cssConfig.inputRadius,
        '--chat-width': config.cssConfig.chatWidth,
        '--chat-height': config.cssConfig.chatHeight,
        '--font-family': config.cssConfig.fontFamily,
        '--font-size': config.cssConfig.fontSize,
        maxWidth: config.cssConfig.chatWidth,
        fontFamily: config.cssConfig.fontFamily,
        fontSize: config.cssConfig.fontSize
      }}
    >
      <Head>
        <title>{config.pageTitle}</title>
        <meta name="description" content={config.subHeading} />
      </Head>

      <header
        className={styles.header}
        style={{
          background: `linear-gradient(to right, ${config.cssConfig.secondaryColor}, ${config.cssConfig.primaryColor})`
        }}
      >
        <h1>{config.mainHeading}</h1>
        {config.subHeading && <p>{config.subHeading}</p>}
      </header>

      <div className={styles.chatLayout}>
        <div ref={chatContainerRef} className={styles.chatContainer}>
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.assistantMessage} ${msg.isRating ? styles.ratingMessage : ''}`}
              dangerouslySetInnerHTML={msg.isRating ? { __html: msg.content } : null}
            >
              {!msg.isRating && msg.content}
            </div>
          ))}
          {isLoading && config.cssConfig.showTypingIndicator && (
            <div className={styles.typingIndicator}>
              <div className={styles.typingDot}></div>
              <div className={styles.typingDot}></div>
              <div className={styles.typingDot}></div>
            </div>
          )}
        </div>

        <div className={styles.inputArea}>
          <form onSubmit={handleSubmit} className={styles.inputForm}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={config.inputPlaceholder}
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading}>{config.submitButtonText}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
