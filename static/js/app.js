const { useCallback, useEffect, useMemo, useRef, useState } = React;

function api(path, options = {}) {
  const init = { ...options };
  init.headers = { ...(options.headers || {}) };
  if (init.body !== undefined && typeof init.body !== "string") {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(init.body);
  }
  return fetch(path, init)
    .then((resp) => resp.json())
    .then((result) => {
      if (result.errno !== 0) {
        throw new Error(result.error || "请求失败");
      }
      return result.data || {};
    });
}

function useAudioPlayer() {
  const ref = useRef(null);

  if (!ref.current) {
    ref.current = new Audio();
  }

  const playAudio = useCallback((url) => {
    if (!url) {
      return;
    }
    ref.current.pause();
    ref.current.src = url;
    ref.current.currentTime = 0;
    ref.current.play().catch(() => {});
  }, []);

  return playAudio;
}

function useIsMobile(breakpoint = 960) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= breakpoint : false,
  );

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth <= breakpoint);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);

  return isMobile;
}

function normalizeWordText(raw) {
  return (raw || "").trim().toLowerCase();
}

function getEnglishAudio(row) {
  if (!row) {
    return "";
  }
  return row.en_audio || row.en_audio_url || "";
}

function getAmericanAudio(row) {
  if (!row) {
    return "";
  }
  return row.am_audio || row.am_audio_url || "";
}

function getDefaultAudio(row, accent) {
  const en = getEnglishAudio(row);
  const am = getAmericanAudio(row);
  if (accent === "am") {
    return am || en;
  }
  return en || am;
}

function formatReciteDateText(rawDate) {
  const text = (rawDate || "").trim();
  if (!text) {
    return "-";
  }
  return text;
}

function buildReviewQuery(date) {
  const text = (date || "").trim();
  if (!text) {
    return "";
  }
  return `?date=${encodeURIComponent(text)}`;
}

function formatMeaningLines(parts, limit = 0) {
  const rows = (parts || []).map((part) => {
    const means = Array.isArray(part.means) ? part.means.join("；") : "";
    if (!part.part) {
      return means;
    }
    return `${part.part} ${means}`.trim();
  }).filter(Boolean);
  if (limit > 0) {
    return rows.slice(0, limit);
  }
  return rows;
}

function renderMeaningPreview(parts) {
  const rows = formatMeaningLines(parts, 2).map((row) => row.split("；").slice(0, 3).join("；"));
  if (rows.length === 0) {
    return "-";
  }
  return rows.join("；");
}

function PartAndSentence({
  row,
  playAudio,
  forceAllSentences = false,
  largeTabs = false,
  looseSentence = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const [groupIndex, setGroupIndex] = useState(0);
  const sentenceGroups = row.sentence_groups || [];
  const currentGroup = sentenceGroups[groupIndex] || sentenceGroups[0] || null;
  const sentences = currentGroup ? currentGroup.sentences || [] : [];
  const visibleSentences = forceAllSentences ? sentences : (expanded ? sentences : sentences.slice(0, 3));

  useEffect(() => {
    setGroupIndex(0);
    setExpanded(false);
  }, [row.word, sentenceGroups.length]);

  return (
    <div className="explain-box">
      <div>
        <div className="small-title">释义</div>
        <ul className="part-list">
          {(row.parts || []).map((part, idx) => (
            <li key={`${part.part}-${idx}`}>
              <strong>{part.part}</strong> {part.means.join("; ")}
            </li>
          ))}
          {(row.parts || []).length === 0 && <li>-</li>}
        </ul>
      </div>

      <div className="section-divider" />

      <div>
        <div className="small-title">例句</div>
        {sentenceGroups.length > 1 && (
          <div className="sentence-group-tabs">
            {sentenceGroups.map((group, idx) => {
              const label = group.tag || group.meaning || group.word || `分组${idx + 1}`;
              return (
                <button
                  key={`${label}-${idx}`}
                  className={`group-tab ${largeTabs ? "large" : ""} ${idx === groupIndex ? "active" : ""}`}
                  onClick={() => setGroupIndex(idx)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
        {visibleSentences.length > 0 ? (
          <ul className="sentence-list">
            {visibleSentences.map((sentence, idx) => (
              <li className={`sentence-item ${looseSentence ? "loose" : ""}`} key={`${sentence.en}-${idx}`}>
                <span className="sentence-en" onClick={() => playAudio(sentence.ttsUrl)}>
                  {sentence.en}
                </span>
                {sentence.ttsUrl && (
                  <a
                    className="play-icon-link"
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      playAudio(sentence.ttsUrl);
                    }}
                  >
                    {"\u25B6"}
                  </a>
                )}
                <div className="sentence-cn">{sentence.cn}</div>
              </li>
            ))}
          </ul>
        ) : (
          <div>-</div>
        )}
        {!forceAllSentences && sentences.length > 3 && (
          <button className="text-btn" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "收起例句" : "展开更多例句"}
          </button>
        )}
      </div>
    </div>
  );
}

function WordTable({ rows, playAudio, operationLabel, onOperation, resultResolver }) {
  const showOperation = Boolean(operationLabel && onOperation);
  return (
    <table className="word-table">
      <thead>
        <tr>
          <th style={{ width: "56px" }}>序号</th>
          <th style={{ width: "160px" }}>单词</th>
          {resultResolver && <th style={{ width: "92px" }}>结果</th>}
          <th>单词说明</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => {
          const result = resultResolver ? resultResolver(row, idx) : null;
          return (
            <tr key={`${row.word}-${idx}`}>
              <td>{idx + 1}</td>
              <td>{row.word}</td>
              {resultResolver && (
                <td>
                  <span className={`quiz-result-text ${result ? result.className || "" : ""}`}>
                    {result ? result.text : "-"}
                  </span>
                  {result && result.detail && (
                    <div className="quiz-result-detail">{result.detail}</div>
                  )}
                </td>
              )}
              <td>
                <div className="desc-cell">
                  <div className="desc-header">
                    <div className="small-title">发音</div>
                    <div className="desc-right-tools">
                      {row.mean_tag && <span className="desc-tag">{row.mean_tag}</span>}
                      {showOperation && (
                        <a
                          className="desc-op-link"
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            onOperation(row.word, row, idx);
                          }}
                        >
                          {operationLabel}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="yinbiao-inline">
                    <span>英音：[{row.ph_en || "-"}]</span>
                    <a
                      className="play-icon-link"
                      href="#"
                      onMouseEnter={() => playAudio(row.en_audio)}
                      onClick={(e) => {
                        e.preventDefault();
                        playAudio(row.en_audio);
                      }}
                    >
                      {"\u25B6"}
                    </a>
                    <span className="yinbiao-gap">美音：[{row.ph_am || "-"}]</span>
                    <a
                      className="play-icon-link"
                      href="#"
                      onMouseEnter={() => playAudio(row.am_audio || row.en_audio)}
                      onClick={(e) => {
                        e.preventDefault();
                        playAudio(row.am_audio || row.en_audio);
                      }}
                    >
                      {"\u25B6"}
                    </a>
                  </div>
                  <div className="section-divider" />
                  <PartAndSentence row={row} playAudio={playAudio} />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MeaningCell({ parts }) {
  const safeParts = parts || [];
  if (safeParts.length === 0) {
    return <div>-</div>;
  }
  return (
    <ul className="part-list">
      {safeParts.map((part, idx) => (
        <li key={`${part.part || "part"}-${idx}`}>
          <strong>{part.part}</strong> {Array.isArray(part.means) ? part.means.join("; ") : ""}
        </li>
      ))}
    </ul>
  );
}

function TodoPanel() {
  const [text, setText] = useState("正在加载...");

  useEffect(() => {
    api("/api/todo/placeholder")
      .then((data) => setText(data.message || "todo list 功能待开发"))
      .catch((err) => setText(err.message));
  }, []);

  return (
    <div className="right-panel-inner">
      <h2>Todo List</h2>
      <p>{text}</p>
    </div>
  );
}

function DictationPanel({
  title,
  quizType,
  startPayload,
  quizId,
  onBack,
  operationLabel,
  onOperation,
  defaultAccent,
  readOnly = false,
  onQuizStateChange,
}) {
  const playAudio = useAudioPlayer();
  const finishOnceRef = useRef(false);
  const isDictation = quizType === "读写";
  const [words, setWords] = useState([]);
  const [quiz, setQuiz] = useState(null);
  const [index, setIndex] = useState(-1);
  const [showAnswer, setShowAnswer] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [resultMap, setResultMap] = useState({});
  const [wordStatusMap, setWordStatusMap] = useState({});
  const [submittedInputMap, setSubmittedInputMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function wordKey(row) {
    return Number(row && row.seq) || 0;
  }

  function resultMeta(status, detail) {
    if (status === "correct") {
      return { text: "正确", className: "correct" };
    }
    if (status === "forgotten") {
      return { text: "忘记", className: "forgotten" };
    }
    return { text: "错误", className: "wrong", detail: detail || "-" };
  }

  function serverResultToLocal(raw) {
    if (raw === "正确") {
      return "correct";
    }
    if (raw === "忘记") {
      return "forgotten";
    }
    if (raw === "错误") {
      return "wrong";
    }
    return "";
  }

  function localResultToServer(raw) {
    if (raw === "correct") {
      return "正确";
    }
    if (raw === "forgotten") {
      return "忘记";
    }
    return "错误";
  }

  function markWordCompleted(row, result, submittedInput) {
    const key = wordKey(row);
    if (key <= 0) {
      return;
    }
    setResultMap((prev) => ({ ...prev, [key]: result }));
    setWordStatusMap((prev) => ({ ...prev, [key]: "已测试" }));
    setSubmittedInputMap((prev) => ({ ...prev, [key]: submittedInput || "" }));
    setWords((prev) => prev.map((item) => (
      wordKey(item) === key
        ? {
          ...item,
          word_status: "已测试",
          quiz_result: localResultToServer(result),
          input_answer: submittedInput || "",
        }
        : item
    )));
  }

  function findFirstPendingIndex(rows, statusMap) {
    for (let i = 0; i < rows.length; i += 1) {
      const key = wordKey(rows[i]);
      if ((statusMap[key] || "未测试") !== "已测试") {
        return i;
      }
    }
    return -1;
  }

  function findNextPendingIndex(rows, statusMap, currentIdx) {
    for (let i = currentIdx + 1; i < rows.length; i += 1) {
      const key = wordKey(rows[i]);
      if ((statusMap[key] || "未测试") !== "已测试") {
        return i;
      }
    }
    return -1;
  }

  function finishQuizIfNeeded(force = false) {
    if (!quiz || !quiz.id || readOnly || finishOnceRef.current) {
      return;
    }
    const allDone = words.length > 0 && words.every((row) => {
      const key = wordKey(row);
      return (wordStatusMap[key] || "未测试") === "已测试";
    });
    if (!force && !allDone) {
      return;
    }
    finishOnceRef.current = true;
    api(`/api/recite/quizzes/${quiz.id}/finish`, { method: "POST" })
      .then((data) => {
        if (data.quiz && data.quiz.quiz) {
          setQuiz(data.quiz.quiz);
        }
        if (onQuizStateChange) {
          onQuizStateChange(false);
        }
      })
      .catch((err) => setError(err.message));
  }

  const stats = useMemo(() => {
    const total = words.length;
    let correct = 0;
    let forgotten = 0;
    words.forEach((row) => {
      const status = resultMap[wordKey(row)];
      if (status === "correct") {
        correct += 1;
      } else if (status === "forgotten") {
        forgotten += 1;
      }
    });
    return {
      total,
      correct,
      forgotten,
      wrong: Math.max(total - correct - forgotten, 0),
    };
  }, [words, resultMap]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setWords([]);
    setQuiz(null);
    setIndex(-1);
    setShowAnswer(false);
    setInputValue("");
    setResultMap({});
    setWordStatusMap({});
    setSubmittedInputMap({});
    finishOnceRef.current = false;

    const promise = quizId
      ? api(`/api/recite/quizzes/${quizId}`)
      : api("/api/recite/quizzes/start", { method: "POST", body: startPayload || {} });

    promise
      .then((data) => {
        if (cancelled) {
          return;
        }
        const detail = data.quiz || {};
        const quizInfo = detail.quiz || null;
        const rows = (detail.words || []).map((item) => {
          const wd = item.word_detail || {};
          return {
            ...wd,
            seq: item.seq,
            word_status: item.word_status || "未测试",
            input_answer: item.input_answer || "",
            quiz_result: item.result || "",
          };
        });

        const nextResultMap = {};
        const nextStatusMap = {};
        const nextSubmittedMap = {};
        rows.forEach((row) => {
          const key = wordKey(row);
          nextStatusMap[key] = row.word_status || "未测试";
          nextSubmittedMap[key] = row.input_answer || "";
          const localResult = serverResultToLocal(row.quiz_result || "");
          if (localResult) {
            nextResultMap[key] = localResult;
          }
        });

        setQuiz(quizInfo);
        if (onQuizStateChange && quizInfo) {
          onQuizStateChange(quizInfo.status === "进行中");
        }
        setWords(rows);
        setResultMap(nextResultMap);
        setWordStatusMap(nextStatusMap);
        setSubmittedInputMap(nextSubmittedMap);
        setShowAnswer(Boolean(readOnly || (quizInfo && quizInfo.status === "已完结")));

        if (rows.length === 0 || readOnly || (quizInfo && quizInfo.status === "已完结")) {
          setIndex(-1);
        } else if (quizInfo && quizInfo.next_seq > 0) {
          const nextIdx = rows.findIndex((row) => Number(row.seq) === Number(quizInfo.next_seq));
          if (nextIdx >= 0) {
            setIndex(nextIdx);
          } else {
            setIndex(findFirstPendingIndex(rows, nextStatusMap));
          }
        } else {
          setIndex(findFirstPendingIndex(rows, nextStatusMap));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    quizId,
    readOnly,
    startPayload && startPayload.type,
    startPayload && startPayload.source_kind,
    startPayload && startPayload.unit_id,
    startPayload && startPayload.review_date,
  ]);

  useEffect(() => {
    function onKeyDown(e) {
      if (!isDictation) {
        return;
      }
      if (e.key !== "Meta") {
        return;
      }
      if (index < 0 || index >= words.length) {
        return;
      }
      const row = words[index];
      playAudio(getDefaultAudio(row, defaultAccent));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDictation, index, words, playAudio, defaultAccent]);

  useEffect(() => {
    if (!isDictation || readOnly || loading) {
      return;
    }
    if (index < 0 || index >= words.length) {
      return;
    }
    const row = words[index];
    const key = wordKey(row);
    if ((wordStatusMap[key] || "未测试") === "已测试") {
      return;
    }
    playAudio(getDefaultAudio(row, defaultAccent));
  }, [isDictation, readOnly, loading, index, words, wordStatusMap, defaultAccent, playAudio]);

  useEffect(() => {
    if (readOnly || loading || !quiz || quiz.status === "已完结") {
      return;
    }
    const allDone = words.length > 0 && words.every((row) => {
      const key = wordKey(row);
      return (wordStatusMap[key] || "未测试") === "已测试";
    });
    if (!allDone) {
      return;
    }
    setShowAnswer(true);
    setIndex(-1);
    finishQuizIfNeeded();
  }, [readOnly, loading, quiz && quiz.status, words, wordStatusMap]);

  function submitCurrentInput() {
    if (index < 0 || index >= words.length) {
      return Promise.resolve(false);
    }
    if (!quiz || !quiz.id) {
      return Promise.resolve(false);
    }
    const row = words[index];
    const key = wordKey(row);
    if ((wordStatusMap[key] || "未测试") === "已测试") {
      return Promise.resolve(true);
    }
    const submittedInput = (inputValue || "").trim();
    const ok = normalizeWordText(inputValue) === normalizeWordText(row.word);
    const nextResult = ok ? "correct" : "wrong";
    return api(`/api/recite/quizzes/${quiz.id}/words/${row.seq}/submit`, {
      method: "POST",
      body: {
        input_answer: submittedInput,
        result: localResultToServer(nextResult),
      },
    })
      .then(() => {
        markWordCompleted(row, nextResult, submittedInput);
        return true;
      })
      .catch((err) => {
        setError(err.message);
        return false;
      });
  }

  function readNext() {
    if (readOnly || loading) {
      return;
    }
    if (showAnswer) {
      return;
    }
    if (words.length === 0) {
      setShowAnswer(true);
      finishQuizIfNeeded(true);
      return;
    }
    if (index < 0) {
      const nextIdx = findFirstPendingIndex(words, wordStatusMap);
      if (nextIdx < 0) {
        setShowAnswer(true);
        finishQuizIfNeeded(true);
        return;
      }
      setIndex(nextIdx);
      setInputValue("");
      if (isDictation) {
        playAudio(getDefaultAudio(words[nextIdx], defaultAccent));
      }
      return;
    }
    submitCurrentInput().then((ok) => {
      if (!ok) {
        return;
      }
      setInputValue("");
      const nextIndex = findNextPendingIndex(words, { ...wordStatusMap, [wordKey(words[index])]: "已测试" }, index);
      if (nextIndex < 0) {
        setShowAnswer(true);
        setIndex(-1);
        finishQuizIfNeeded(true);
        return;
      }
      const row = words[nextIndex];
      setIndex(nextIndex);
      if (isDictation) {
        playAudio(getDefaultAudio(row, defaultAccent));
      }
    });
  }

  function repeatCurrent() {
    if (!isDictation) {
      return;
    }
    if (index < 0 || index >= words.length) {
      return;
    }
    const row = words[index];
    playAudio(getDefaultAudio(row, defaultAccent));
  }

  function operateCurrentAndSkip() {
    if (readOnly || index < 0 || index >= words.length || !onOperation || !quiz || !quiz.id) {
      return;
    }
    const row = words[index];
    onOperation(row.word)
      .then(() => {
        return api(`/api/recite/quizzes/${quiz.id}/words/${row.seq}/submit`, {
          method: "POST",
          body: {
            input_answer: (inputValue || "").trim(),
            result: "忘记",
          },
        }).then(() => {
          markWordCompleted(row, "forgotten", (inputValue || "").trim());
          setInputValue("");
          const nextIndex = findNextPendingIndex(words, { ...wordStatusMap, [wordKey(row)]: "已测试" }, index);
          if (nextIndex < 0) {
            setShowAnswer(true);
            setIndex(-1);
            finishQuizIfNeeded(true);
            return;
          }
          const next = words[nextIndex];
          setIndex(nextIndex);
          if (isDictation) {
            playAudio(getDefaultAudio(next, defaultAccent));
          }
        });
      })
      .catch((err) => setError(err.message));
  }

  function handleOperation(word, targetRow) {
    if (!onOperation) {
      return;
    }
    onOperation(word)
      .then(() => {
        const row = targetRow || words.find((item) => item.word === word);
        if (!row || !quiz || !quiz.id) {
          return;
        }
        return api(`/api/recite/quizzes/${quiz.id}/words/${row.seq}/submit`, {
          method: "POST",
          body: {
            input_answer: "",
            result: "忘记",
          },
        }).then(() => {
          markWordCompleted(row, "forgotten", "");
        });
      })
      .catch((err) => setError(err.message));
  }

  const current = index >= 0 && index < words.length ? words[index] : null;
  const currentMeaningLines = useMemo(() => {
    if (!current) {
      return [];
    }
    return formatMeaningLines(current.parts);
  }, [current && current.word, current && current.parts]);

  if (loading) {
    return (
      <div className="right-panel-inner">
        <h2>{title}</h2>
        <p className="helper-tip">加载中...</p>
      </div>
    );
  }

  return (
    <div className="right-panel-inner">
      <h2>{title}</h2>
      <div className="dictation-box">
        <div className="progress">
          当前进度：{Math.max(index + 1, 0)} / {words.length}
        </div>
        {!readOnly && (
          <>
            {quizType === "默写" && current && (
              <div className="quiz-current-meaning">
                {currentMeaningLines.length > 0 ? currentMeaningLines.map((line, idx) => (
                  <div key={`${current.word}-desktop-meaning-${idx}`}>{line}</div>
                )) : <div>-</div>}
              </div>
            )}
            <div className="dictation-input-row">
              <input
                className="input dictation-input"
                placeholder={isDictation ? "输入听到的单词" : "输入单词"}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    readNext();
                  }
                }}
              />
            </div>
            <div className="dictation-actions">
              <button className="btn brand" onClick={readNext}>
                {index < 0 ? "开始测试" : "确认并下一单词"}
              </button>
              {isDictation && <button className="btn" onClick={repeatCurrent}>重复当前单词</button>}
              <button className="btn" onClick={operateCurrentAndSkip}>{operationLabel}</button>
              <button className="btn secondary" onClick={() => setShowAnswer((v) => !v)}>
                {showAnswer ? "隐藏答案" : "显示答案"}
              </button>
              <button className="btn secondary" onClick={onBack}>返回列表</button>
            </div>
          </>
        )}
        {readOnly && (
          <div className="dictation-actions">
            <button className="btn secondary" onClick={onBack}>返回列表</button>
          </div>
        )}
        {error && <div className="error">{error}</div>}
      </div>
      {showAnswer && (
        <div style={{ marginTop: "14px" }}>
          <div className="quiz-stat-line">
            测验结果：共{quizType}单词 {stats.total} 个，正确 {stats.correct} 个，错误 {stats.wrong} 个，忘记 {stats.forgotten} 个
          </div>
          <WordTable
            rows={words}
            playAudio={playAudio}
            operationLabel={operationLabel}
            onOperation={handleOperation}
            resultResolver={(row) => {
              const key = wordKey(row);
              const status = resultMap[key] || "wrong";
              return resultMeta(status, submittedInputMap[key]);
            }}
          />
        </div>
      )}
    </div>
  );
}

function SpellingPanel(props) {
  return <DictationPanel {...props} quizType="默写" />;
}

function ReciteUnitPanel({ unit, notify, defaultAccent, onQuizStateChange }) {
  const playAudio = useAudioPlayer();
  const [view, setView] = useState("detail");
  const [wordInput, setWordInput] = useState("");
  const [queryWord, setQueryWord] = useState(null);
  const [wordRows, setWordRows] = useState([]);
  const [loadingWords, setLoadingWords] = useState(true);
  const [error, setError] = useState("");

  function loadWords() {
    setLoadingWords(true);
    return api(`/api/recite/units/${unit.id}/words`)
      .then((data) => setWordRows(data.words || []))
      .finally(() => setLoadingWords(false));
  }

  useEffect(() => {
    setView("detail");
    setWordInput("");
    setQueryWord(null);
    setWordRows([]);
    setLoadingWords(true);
    setError("");
    loadWords().catch((err) => setError(err.message));
  }, [unit.id]);

  function doQueryWord() {
    setError("");
    api("/api/recite/words/query", { method: "POST", body: { word: wordInput } })
      .then((data) => {
        setQueryWord(data.word);
        playAudio(getDefaultAudio(data.word, defaultAccent));
      })
      .catch((err) => setError(err.message));
  }

  function addWordToUnit() {
    if (!queryWord) {
      return;
    }
    api(`/api/recite/units/${unit.id}/words`, {
      method: "POST",
      body: { word: queryWord.word },
    })
      .then(() => loadWords())
      .catch((err) => setError(err.message));
  }

  function forgetWord(word) {
    return api("/api/recite/forgotten/words", {
      method: "POST",
      body: { word },
    }).then(() => {
      if (notify) {
        notify("已添加到遗忘单词本");
      }
    });
  }

  if (view === "dictation") {
    return (
      <DictationPanel
        title="听写单词"
        quizType="读写"
        startPayload={{
          type: "读写",
          source_kind: "unit",
          unit_id: unit.id,
          review_date: "",
        }}
        operationLabel="忘记"
        onOperation={forgetWord}
        defaultAccent={defaultAccent}
        onQuizStateChange={onQuizStateChange}
        onBack={() => setView("detail")}
      />
    );
  }
  if (view === "spelling") {
    return (
      <SpellingPanel
        title="默写单词"
        startPayload={{
          type: "默写",
          source_kind: "unit",
          unit_id: unit.id,
          review_date: "",
        }}
        operationLabel="忘记"
        onOperation={forgetWord}
        defaultAccent={defaultAccent}
        onQuizStateChange={onQuizStateChange}
        onBack={() => setView("detail")}
      />
    );
  }

  if (loadingWords) {
    return (
      <div className="right-panel-inner">
        <h2>单元：{unit.name}</h2>
        <p className="helper-tip">加载中...</p>
      </div>
    );
  }

  return (
    <div className="right-panel-inner">
      <div className="panel-header-row">
        <h2>单元：{unit.name}</h2>
        <div className="unit-actions">
          <button className="btn secondary" onClick={() => setView("dictation")}>听写单词</button>
          <button className="btn secondary" onClick={() => setView("spelling")}>默写单词</button>
        </div>
      </div>

      <div className="unit-top-grid">
        <section className="unit-search-section">
          <div className="unit-actions">
            <input
              className="input"
              placeholder="输入要查询的单词"
              value={wordInput}
              onChange={(e) => setWordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  doQueryWord();
                }
              }}
            />
            <button className="btn" onClick={doQueryWord}>查询</button>
          </div>
          {queryWord && (
            <div>
              <div className="desc-header">
                <div className="small-title">发音</div>
                <div className="desc-right-tools">
                  {queryWord.mean_tag && <span className="desc-tag">{queryWord.mean_tag}</span>}
                </div>
              </div>
              <div className="yinbiao-inline">
                <span>英音：[{queryWord.ph_en || "-"}]</span>
                <a
                  className="play-icon-link"
                  href="#"
                  onMouseEnter={() => playAudio(queryWord.en_audio_url)}
                  onClick={(e) => {
                    e.preventDefault();
                    playAudio(queryWord.en_audio_url);
                  }}
                >
                  {"\u25B6"}
                </a>
                <span className="yinbiao-gap">美音：[{queryWord.ph_am || "-"}]</span>
                <a
                  className="play-icon-link"
                  href="#"
                  onMouseEnter={() => playAudio(queryWord.am_audio_url || queryWord.en_audio_url)}
                  onClick={(e) => {
                    e.preventDefault();
                    playAudio(queryWord.am_audio_url || queryWord.en_audio_url);
                  }}
                >
                  {"\u25B6"}
                </a>
              </div>
              <div className="section-divider" />
              <PartAndSentence
                row={{
                  word: queryWord.word,
                  parts: queryWord.parts,
                  sentence_groups: queryWord.sentence_groups,
                }}
                playAudio={playAudio}
              />
              <button className="btn brand" onClick={addWordToUnit}>添加到单元</button>
            </div>
          )}
        </section>
        <div className="unit-info-box">
          <div>背诵时间：{formatReciteDateText(unit.recite_date)}</div>
          <div>共{wordRows.length}个单词</div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <section>
        <h3>单元单词</h3>
        <WordTable
          rows={wordRows}
          playAudio={playAudio}
          operationLabel="忘记"
          onOperation={(word) => forgetWord(word).catch((err) => setError(err.message))}
        />
      </section>
    </div>
  );
}

function ForgottenPanel({ notify, defaultAccent, onQuizStateChange }) {
  const playAudio = useAudioPlayer();
  const [view, setView] = useState("detail");
  const [wordRows, setWordRows] = useState([]);
  const [error, setError] = useState("");

  function loadWords() {
    return api("/api/recite/forgotten/words")
      .then((data) => setWordRows(data.words || []));
  }

  useEffect(() => {
    setError("");
    loadWords().catch((err) => setError(err.message));
  }, []);

  function rememberWord(word) {
    return api("/api/recite/forgotten/words/remember", {
      method: "POST",
      body: { word },
    }).then(() => {
      setWordRows((prev) => prev.filter((item) => item.word !== word));
      if (notify) {
        notify("已标记为记住");
      }
    });
  }

  if (view === "dictation") {
    return (
      <DictationPanel
        title="听写单词（遗忘单词）"
        quizType="读写"
        startPayload={{
          type: "读写",
          source_kind: "forgotten",
          unit_id: 0,
          review_date: "",
        }}
        operationLabel="记住"
        onOperation={rememberWord}
        defaultAccent={defaultAccent}
        onQuizStateChange={onQuizStateChange}
        onBack={() => {
          setView("detail");
          loadWords().catch((err) => setError(err.message));
        }}
      />
    );
  }
  if (view === "spelling") {
    return (
      <SpellingPanel
        title="默写单词（遗忘单词）"
        startPayload={{
          type: "默写",
          source_kind: "forgotten",
          unit_id: 0,
          review_date: "",
        }}
        operationLabel="记住"
        onOperation={rememberWord}
        defaultAccent={defaultAccent}
        onQuizStateChange={onQuizStateChange}
        onBack={() => {
          setView("detail");
          loadWords().catch((err) => setError(err.message));
        }}
      />
    );
  }

  return (
    <div className="right-panel-inner">
      <div className="panel-header-row">
        <h2>遗忘单词</h2>
        <div className="unit-actions">
          <button className="btn secondary" onClick={() => setView("dictation")}>听写单词</button>
          <button className="btn secondary" onClick={() => setView("spelling")}>默写单词</button>
        </div>
      </div>
      <div className="unit-info-row">
        <div className="unit-info-box">
          <div>共{wordRows.length}个单词</div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {wordRows.length === 0 ? (
        <p className="helper-tip">暂无遗忘单词。</p>
      ) : (
        <WordTable
          rows={wordRows}
          playAudio={playAudio}
          operationLabel="记住"
          onOperation={(word) => rememberWord(word).catch((err) => setError(err.message))}
        />
      )}
    </div>
  );
}

function ReviewPanel({
  notify,
  defaultAccent,
  reviewDates,
  selectedReviewDate,
  onReviewDateChange,
  onQuizStateChange,
}) {
  const playAudio = useAudioPlayer();
  const [view, setView] = useState("detail");
  const [wordRows, setWordRows] = useState([]);
  const [reviewUnits, setReviewUnits] = useState([]);
  const [loadingWords, setLoadingWords] = useState(true);
  const [error, setError] = useState("");
  const query = buildReviewQuery(selectedReviewDate);

  function loadWords() {
    setLoadingWords(true);
    setError("");
    return api(`/api/recite/review/words${query}`)
      .then((data) => {
        setWordRows(data.words || []);
        setReviewUnits(data.units || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingWords(false));
  }

  useEffect(() => {
    setView("detail");
    setWordRows([]);
    setReviewUnits([]);
    loadWords();
  }, [query]);

  function forgetWord(word) {
    return api("/api/recite/forgotten/words", {
      method: "POST",
      body: { word },
    }).then(() => {
      if (notify) {
        notify("已添加到遗忘单词本");
      }
    });
  }

  if (view === "dictation") {
    return (
      <DictationPanel
        title="听写单词（今日复习）"
        quizType="读写"
        startPayload={{
          type: "读写",
          source_kind: "review",
          unit_id: 0,
          review_date: selectedReviewDate || "",
        }}
        operationLabel="忘记"
        onOperation={forgetWord}
        defaultAccent={defaultAccent}
        onQuizStateChange={onQuizStateChange}
        onBack={() => setView("detail")}
      />
    );
  }
  if (view === "spelling") {
    return (
      <SpellingPanel
        title="默写单词（今日复习）"
        startPayload={{
          type: "默写",
          source_kind: "review",
          unit_id: 0,
          review_date: selectedReviewDate || "",
        }}
        operationLabel="忘记"
        onOperation={forgetWord}
        defaultAccent={defaultAccent}
        onQuizStateChange={onQuizStateChange}
        onBack={() => setView("detail")}
      />
    );
  }

  return (
    <div className="right-panel-inner">
      <div className="panel-header-row">
        <h2>今日复习</h2>
        <div className="unit-actions">
          <select
            className="input review-date-select"
            value={selectedReviewDate || ""}
            onChange={(e) => onReviewDateChange(e.target.value)}
          >
            {(reviewDates || []).map((date) => (
              <option key={date} value={date}>{date}</option>
            ))}
          </select>
          <button className="btn secondary" onClick={() => setView("dictation")}>听写单词</button>
          <button className="btn secondary" onClick={() => setView("spelling")}>默写单词</button>
        </div>
      </div>
      <div className="unit-info-row">
        <div className="unit-info-box">
          <div>共{wordRows.length}个单词，包含：</div>
          {reviewUnits.length === 0 ? (
            <div>-</div>
          ) : reviewUnits.map((item) => (
            <div key={item.unit_id}>
              {item.name},共{item.word_count}个单词，记忆时间 {formatReciteDateText(item.recite_date)}，距离今天{item.distance_days}天
            </div>
          ))}
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {loadingWords && <p className="helper-tip">加载中...</p>}
      {!loadingWords && wordRows.length === 0 && <p className="helper-tip">当天暂无需要复习的单词。</p>}
      {!loadingWords && wordRows.length > 0 && (
        <WordTable
          rows={wordRows}
          playAudio={playAudio}
          operationLabel="忘记"
          onOperation={(word) => forgetWord(word).catch((err) => setError(err.message))}
        />
      )}
    </div>
  );
}

function QuizListPanel({ notify, defaultAccent, onQuizStateChange }) {
  const [view, setView] = useState("list");
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeItem, setActiveItem] = useState(null);

  function loadList(nextPage = 1) {
    setLoading(true);
    setError("");
    return api(`/api/recite/quizzes?page=${Math.max(nextPage, 1)}&page_size=20`)
      .then((data) => {
        setRows(data.items || []);
        setTotal(Number(data.total) || 0);
        setPage(Math.max(Number(data.page) || nextPage, 1));
        if (onQuizStateChange) {
          onQuizStateChange(Boolean(data.has_running));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setView("list");
    setActiveItem(null);
    loadList(1);
  }, []);

  function forgetWord(word) {
    return api("/api/recite/forgotten/words", {
      method: "POST",
      body: { word },
    }).then(() => {
      if (notify) {
        notify("已添加到遗忘单词本");
      }
    });
  }

  function rememberWord(word) {
    return api("/api/recite/forgotten/words/remember", {
      method: "POST",
      body: { word },
    }).then(() => {
      if (notify) {
        notify("已标记为记住");
      }
    });
  }

  if (view === "quiz" && activeItem) {
    const isSpelling = activeItem.type === "默写";
    const readOnly = activeItem.status !== "进行中";
    const opLabel = activeItem.source === "forgotten" ? "记住" : "忘记";
    const opAction = activeItem.source === "forgotten" ? rememberWord : forgetWord;
    const title = readOnly ? activeItem.title : `${activeItem.title}（进行中）`;
    const panelProps = {
      title,
      quizId: activeItem.id,
      operationLabel: readOnly ? "" : opLabel,
      onOperation: readOnly ? null : opAction,
      defaultAccent,
      readOnly,
      onQuizStateChange,
      onBack: () => {
        setView("list");
        setActiveItem(null);
        loadList(page);
      },
    };
    if (isSpelling) {
      return <SpellingPanel {...panelProps} />;
    }
    return <DictationPanel {...panelProps} quizType="读写" />;
  }

  const totalPages = Math.max(Math.ceil(total / 20), 1);
  return (
    <div className="right-panel-inner">
      <h2>测试列表</h2>
      {error && <div className="error">{error}</div>}
      {loading && <p className="helper-tip">加载中...</p>}
      {!loading && rows.length === 0 && <p className="helper-tip">暂无测试记录。</p>}
      {!loading && rows.length > 0 && (
        <table className="word-table">
          <thead>
            <tr>
              <th style={{ width: "56px" }}>序号</th>
              <th>标题</th>
              <th style={{ width: "110px" }}>状态</th>
              <th style={{ width: "200px" }}>统计</th>
              <th style={{ width: "180px" }}>创建时间</th>
              <th style={{ width: "100px" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item, idx) => (
              <tr key={item.id}>
                <td>{(page - 1) * 20 + idx + 1}</td>
                <td>{item.status === "进行中" ? `${item.title}（进行中）` : item.title}</td>
                <td>{item.status}</td>
                <td>
                  共{item.stats.total}，已测{item.stats.tested}，正确{item.stats.correct}，错误{item.stats.wrong}，忘记{item.stats.forgotten}
                </td>
                <td>{item.created_at}</td>
                <td>
                  <button
                    className="btn secondary"
                    onClick={() => {
                      setActiveItem(item);
                      setView("quiz");
                    }}
                  >
                    {item.status === "进行中" ? "继续测试" : "查看结果"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && totalPages > 1 && (
        <div className="dictation-actions">
          <button className="btn secondary" disabled={page <= 1} onClick={() => loadList(page - 1)}>上一页</button>
          <div>{page}/{totalPages}</div>
          <button className="btn secondary" disabled={page >= totalPages} onClick={() => loadList(page + 1)}>下一页</button>
        </div>
      )}
    </div>
  );
}

function MobileWordDetailBody({ row, playAudio }) {
  if (!row) {
    return null;
  }
  return (
    <div className="mobile-word-detail-body">
      <div className="mobile-word-audio-row">
        <span>英 [{row.ph_en || "-"}]</span>
        <a
          className="play-icon-link"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            playAudio(row.en_audio || row.en_audio_url);
          }}
        >
          {"\u25B6"}
        </a>
        <span className="yinbiao-gap">美 [{row.ph_am || "-"}]</span>
        <a
          className="play-icon-link"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            playAudio(row.am_audio || row.am_audio_url || row.en_audio || row.en_audio_url);
          }}
        >
          {"\u25B6"}
        </a>
      </div>
      {row.mean_tag && <div className="mobile-word-tag">{row.mean_tag}</div>}
      <div className="section-divider" />
      <PartAndSentence
        row={row}
        playAudio={playAudio}
        forceAllSentences
        largeTabs
        looseSentence
      />
    </div>
  );
}

function MobileQuizPanel({
  title,
  type,
  startPayload,
  quizId,
  onBack,
  operationLabel,
  onOperation,
  defaultAccent,
  readOnly = false,
  onQuizStateChange,
}) {
  const playAudio = useAudioPlayer();
  const finishOnceRef = useRef(false);
  const inputRef = useRef(null);
  const [quiz, setQuiz] = useState(null);
  const [words, setWords] = useState([]);
  const [index, setIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState("");
  const [statusMap, setStatusMap] = useState({});
  const [wordStatusMap, setWordStatusMap] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [detailWord, setDetailWord] = useState(null);
  const current = words[index] || null;

  function rowKey(row) {
    return Number(row && row.seq) || 0;
  }

  function findFirstPendingIndex(rows, stateMap) {
    for (let i = 0; i < rows.length; i += 1) {
      const key = rowKey(rows[i]);
      if ((stateMap[key] || "未测试") !== "已测试") {
        return i;
      }
    }
    return -1;
  }

  function findNextPendingIndex(rows, stateMap, fromIdx) {
    for (let i = fromIdx + 1; i < rows.length; i += 1) {
      const key = rowKey(rows[i]);
      if ((stateMap[key] || "未测试") !== "已测试") {
        return i;
      }
    }
    return -1;
  }

  function finishQuizIfNeeded(force = false) {
    if (!quiz || !quiz.id || readOnly || finishOnceRef.current) {
      return;
    }
    const allDone = words.length > 0 && words.every((row) => {
      const key = rowKey(row);
      return (wordStatusMap[key] || "未测试") === "已测试";
    });
    if (!force && !allDone) {
      return;
    }
    finishOnceRef.current = true;
    api(`/api/recite/quizzes/${quiz.id}/finish`, { method: "POST" })
      .then((data) => {
        if (data.quiz && data.quiz.quiz) {
          setQuiz(data.quiz.quiz);
        }
        if (onQuizStateChange) {
          onQuizStateChange(false);
        }
      })
      .catch((err) => setError(err.message));
  }

  const stats = useMemo(() => {
    const total = words.length;
    let correct = 0;
    let wrong = 0;
    let operated = 0;
    for (let i = 0; i < words.length; i += 1) {
      const key = rowKey(words[i]);
      const status = statusMap[key];
      if (status === "correct") {
        correct += 1;
      } else if (status === "wrong") {
        wrong += 1;
      } else if (status === "operated") {
        operated += 1;
      }
    }
    const unresolved = Math.max(total - correct - wrong - operated, 0);
    return {
      total,
      correct,
      wrong: wrong + unresolved,
      operated,
    };
  }, [words, statusMap]);
  const scoreValue = useMemo(() => {
    if (stats.total <= 0) {
      return 0;
    }
    return Math.round((stats.correct * 100) / stats.total);
  }, [stats.correct, stats.total]);
  const currentMeaningLines = useMemo(() => {
    if (!current) {
      return [];
    }
    return formatMeaningLines(current.parts);
  }, [current]);

  const incorrectRows = useMemo(() => {
    const ret = [];
    for (let i = 0; i < words.length; i += 1) {
      const key = rowKey(words[i]);
      const status = statusMap[key];
      if (status === "wrong" || status === "operated") {
        ret.push({
          row: words[i],
          index: i,
          status,
        });
      }
    }
    return ret;
  }, [words, statusMap]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setQuiz(null);
    finishOnceRef.current = false;
    const promise = quizId
      ? api(`/api/recite/quizzes/${quizId}`)
      : api("/api/recite/quizzes/start", { method: "POST", body: startPayload || {} });
    promise
      .then((data) => {
        if (cancelled) {
          return;
        }
        const detail = data.quiz || {};
        const quizInfo = detail.quiz || null;
        const rows = (detail.words || []).map((item) => {
          const wd = item.word_detail || {};
          return {
            ...wd,
            seq: item.seq,
            word_status: item.word_status || "未测试",
            input_answer: item.input_answer || "",
            quiz_result: item.result || "",
          };
        });
        const nextStatusMap = {};
        const nextWordStatusMap = {};
        rows.forEach((row) => {
          const key = rowKey(row);
          nextWordStatusMap[key] = row.word_status || "未测试";
          if (row.quiz_result === "正确") {
            nextStatusMap[key] = "correct";
          } else if (row.quiz_result === "错误") {
            nextStatusMap[key] = "wrong";
          } else if (row.quiz_result === "忘记") {
            nextStatusMap[key] = "operated";
          }
        });

        setQuiz(quizInfo);
        if (onQuizStateChange && quizInfo) {
          onQuizStateChange(quizInfo.status === "进行中");
        }
        setWords(rows);
        setStatusMap(nextStatusMap);
        setWordStatusMap(nextWordStatusMap);
        setInputValue("");
        setRevealed(false);
        setResult("");
        const isFinished = Boolean(readOnly || (quizInfo && quizInfo.status === "已完结"));
        if (isFinished || rows.length === 0) {
          setIndex(0);
        } else if (quizInfo && quizInfo.next_seq > 0) {
          const nextIdx = rows.findIndex((row) => Number(row.seq) === Number(quizInfo.next_seq));
          if (nextIdx >= 0) {
            setIndex(nextIdx);
          } else {
            setIndex(findFirstPendingIndex(rows, nextWordStatusMap));
          }
        } else {
          setIndex(findFirstPendingIndex(rows, nextWordStatusMap));
        }
        setFinished(isFinished || rows.length === 0);
        setDetailWord(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    quizId,
    readOnly,
    startPayload && startPayload.type,
    startPayload && startPayload.source_kind,
    startPayload && startPayload.unit_id,
    startPayload && startPayload.review_date,
  ]);

  useEffect(() => {
    if (type === "dictation" && current && !revealed && !readOnly) {
      playAudio(getDefaultAudio(current, defaultAccent));
    }
  }, [type, current && current.word, revealed, readOnly, defaultAccent, playAudio]);

  useEffect(() => {
    if (loading || finished || !current || revealed) {
      return;
    }
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [loading, finished, revealed, index, current && current.word]);

  function goNext() {
    if (!current) {
      setFinished(true);
      finishQuizIfNeeded(true);
      return;
    }
    const nextIndex = findNextPendingIndex(words, wordStatusMap, index);
    if (nextIndex < 0) {
      setFinished(true);
      finishQuizIfNeeded(true);
      return;
    }
    setIndex(nextIndex);
    setInputValue("");
    setRevealed(false);
    setResult("");
  }

  function submitOrNext() {
    if (readOnly || !quiz || !quiz.id) {
      return;
    }
    if (!current) {
      return;
    }
    if (revealed) {
      goNext();
      return;
    }
    const submittedInput = (inputValue || "").trim();
    const ok = normalizeWordText(inputValue) === normalizeWordText(current.word);
    const nextResult = ok ? "correct" : "wrong";
    api(`/api/recite/quizzes/${quiz.id}/words/${current.seq}/submit`, {
      method: "POST",
      body: {
        input_answer: submittedInput,
        result: ok ? "正确" : "错误",
      },
    })
      .then(() => {
        const key = rowKey(current);
        setStatusMap((prev) => ({ ...prev, [key]: nextResult }));
        setWordStatusMap((prev) => ({ ...prev, [key]: "已测试" }));
        setWords((prev) => prev.map((row) => (
          rowKey(row) === key ? { ...row, word_status: "已测试", input_answer: submittedInput, quiz_result: ok ? "正确" : "错误" } : row
        )));
        setResult(nextResult);
        setRevealed(true);
        if (type === "spelling") {
          playAudio(getDefaultAudio(current, defaultAccent));
        }
      })
      .catch((err) => setError(err.message));
  }

  function handleOperation() {
    if (readOnly || !current || !onOperation || !quiz || !quiz.id) {
      return;
    }
    const shouldCountAsOperate = !revealed;
    onOperation(current.word)
      .then(() => {
        return api(`/api/recite/quizzes/${quiz.id}/words/${current.seq}/submit`, {
          method: "POST",
          body: {
            input_answer: (inputValue || "").trim(),
            result: "忘记",
          },
        }).then(() => {
          if (shouldCountAsOperate) {
            const key = rowKey(current);
            setStatusMap((prev) => ({ ...prev, [key]: "operated" }));
            setWordStatusMap((prev) => ({ ...prev, [key]: "已测试" }));
            setWords((prev) => prev.map((row) => (
              rowKey(row) === key ? { ...row, word_status: "已测试", input_answer: (inputValue || "").trim(), quiz_result: "忘记" } : row
            )));
            setResult("operated");
          }
          setRevealed(true);
        });
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (readOnly || loading || !quiz || quiz.status === "已完结") {
      return;
    }
    const allDone = words.length > 0 && words.every((row) => {
      const key = rowKey(row);
      return (wordStatusMap[key] || "未测试") === "已测试";
    });
    if (!allDone) {
      return;
    }
    setFinished(true);
    finishQuizIfNeeded();
  }, [readOnly, loading, quiz && quiz.status, words, wordStatusMap]);

  if (loading) {
    return (
      <div className="mobile-page-card">
        <div className="mobile-topbar">
          <button className="mobile-back-btn" onClick={onBack}>{"< 退出"}</button>
          <h2 className="mobile-page-title">{title}</h2>
          <div />
        </div>
        <div className="helper-tip">正在加载...</div>
      </div>
    );
  }

  if (detailWord) {
    return (
      <div className="mobile-page-card">
        <div className="mobile-topbar">
          <button className="mobile-back-btn" onClick={() => setDetailWord(null)}>{"< 退出"}</button>
          <div />
          <div />
        </div>
        <h2 className="mobile-page-title mobile-word-page-title">{detailWord.word}</h2>
        <MobileWordDetailBody row={detailWord} playAudio={playAudio} />
      </div>
    );
  }

  if (finished || !current) {
    const finishedTitleClass = `mobile-quiz-finished mobile-quiz-finished-dictation ${incorrectRows.length > 0 ? "with-list" : ""}`.trim();
    return (
      <div className="mobile-page-card">
        <div className="mobile-topbar">
          <button className="mobile-back-btn" onClick={onBack}>{"< 退出"}</button>
          <h2 className="mobile-page-title">{title}</h2>
          <div />
        </div>
        <>
          <div className={finishedTitleClass}>本轮已完成，总分 {scoreValue} 分</div>
          <div className="mobile-quiz-finished-summary-line">单词共：{stats.total} 个</div>
          <div className="mobile-quiz-finished-summary-line">正确：{stats.correct} 个</div>
          <div className="mobile-quiz-finished-summary-line">错误：{stats.wrong} 个</div>
          <div className="mobile-quiz-finished-summary-line">{operationLabel}：{stats.operated} 个</div>
        </>
        {incorrectRows.length > 0 && (
          <div className="mobile-quiz-finished-list">
            {incorrectRows.map((item) => {
              const row = item.row;
              const meaningRows = formatMeaningLines(row.parts);
              return (
                <div key={`${row.word}-${item.index}`} className="mobile-word-item mobile-quiz-finished-item">
                  <div className="mobile-word-item-head mobile-word-item-head-finished">
                    <button
                      className="mobile-word-open-btn"
                      onClick={() => setDetailWord(row)}
                    >
                      {row.word}
                    </button>
                    <div className="mobile-word-item-right-meta">
                      <span className="mobile-word-item-no-inline">#{item.index + 1}</span>
                      <span className={`mobile-word-item-status ${item.status === "wrong" ? "wrong" : "operated"}`}>
                        {item.status === "wrong" ? "错误" : operationLabel}
                      </span>
                    </div>
                  </div>
                  <div className="mobile-word-item-pron">
                    <a
                      className="mobile-pron-link"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        playAudio(getEnglishAudio(row));
                      }}
                    >
                      英 [{row.ph_en || "-"}]
                    </a>
                    <a
                      className="mobile-pron-link"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        playAudio(getAmericanAudio(row) || getEnglishAudio(row));
                      }}
                    >
                      美 [{row.ph_am || "-"}]
                    </a>
                  </div>
                  <div className="mobile-word-item-mean">
                    {meaningRows.length > 0 ? meaningRows.map((line, lineIdx) => (
                      <div key={`${row.word}-quiz-finished-mean-${lineIdx}`} className="mobile-word-item-mean-line">{line}</div>
                    )) : "-"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mobile-page-card mobile-quiz-page">
      <div className="mobile-topbar">
        <button className="mobile-back-btn" onClick={onBack}>{"< 退出"}</button>
        <h2 className="mobile-page-title">{title}</h2>
        <div />
      </div>

      <div className="mobile-quiz-content">
        <div className="mobile-quiz-progress">{index + 1}/{words.length}</div>

        {type === "spelling" && (
          <div className="mobile-quiz-meaning mobile-quiz-meaning-multi">
            {currentMeaningLines.length > 0 ? currentMeaningLines.map((line, idx) => (
              <div key={`${current.word}-quiz-meaning-${idx}`} className="mobile-quiz-meaning-line">{line}</div>
            )) : <div className="mobile-quiz-meaning-line">-</div>}
          </div>
        )}

        <div className={`mobile-quiz-input-row ${type === "dictation" ? "dictation" : ""}`}>
          <input
            ref={inputRef}
            className="input mobile-quiz-input"
            placeholder="输入单词"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                submitOrNext();
              }
            }}
          />
          {type === "dictation" && (
            <>
              <button
                className="btn secondary mobile-replay-btn"
                onClick={() => playAudio(getEnglishAudio(current))}
              >
                英音
              </button>
              <button
                className="btn secondary mobile-replay-btn"
                onClick={() => playAudio(getAmericanAudio(current) || getEnglishAudio(current))}
              >
                美音
              </button>
            </>
          )}
        </div>

        <div className="mobile-quiz-actions">
          <button className="btn secondary" onClick={submitOrNext} disabled={readOnly}>
            {revealed ? "下一个" : "确认"}
          </button>
          <button className="btn secondary" onClick={handleOperation} disabled={readOnly}>
            {operationLabel}
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        {revealed && (
          <div className="mobile-quiz-result-wrap">
            {result === "correct" && <div className="mobile-quiz-result ok">正确</div>}
            {result === "wrong" && <div className="mobile-quiz-result bad">错误</div>}
            {result === "operated" && <div className="mobile-quiz-result op">{operationLabel}</div>}
            <div className="mobile-quiz-word-detail">
              <div className="mobile-quiz-answer-word">{current.word}</div>
              <MobileWordDetailBody row={current} playAudio={playAudio} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MobileReciteRoot({
  units,
  notify,
  onRootHomeChange,
  defaultAccent,
  reviewDates,
  selectedReviewDate,
  onReviewDateChange,
  quizHasRunning,
  onQuizStateChange,
}) {
  const playAudio = useAudioPlayer();
  const [view, setView] = useState("home");
  const [context, setContext] = useState({
    kind: "unit",
    unitId: 0,
    name: "",
    reciteDate: "",
    reviewDate: selectedReviewDate || "",
  });
  const [words, setWords] = useState([]);
  const [reviewUnits, setReviewUnits] = useState([]);
  const [selectedWord, setSelectedWord] = useState(null);
  const [quizRows, setQuizRows] = useState([]);
  const [quizPage, setQuizPage] = useState(1);
  const [quizTotal, setQuizTotal] = useState(0);
  const [quizListLoading, setQuizListLoading] = useState(false);
  const [activeQuizItem, setActiveQuizItem] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [unitMetaExpanded, setUnitMetaExpanded] = useState(false);
  const unitScrollRef = useRef(null);
  const unitScrollTopRef = useRef(0);
  const pageScrollTopRef = useRef(0);
  const pendingRestoreScrollTopRef = useRef(null);
  const pendingRestorePageScrollTopRef = useRef(null);
  const viewRef = useRef("home");
  const contextKeyRef = useRef("unit:0");
  const loadedContextKeyRef = useRef("");

  function buildContextKey(nextContext) {
    const safeContext = nextContext || { kind: "unit", unitId: 0 };
    const reviewDate = safeContext.reviewDate || "";
    return `${safeContext.kind || "unit"}:${Number(safeContext.unitId) || 0}:${reviewDate}`;
  }

  function buildNavState(
    nextView,
    nextContext,
    nextSelectedWord,
    nextUnitScrollTop,
    nextPageScrollTop,
    nextSkipUnitReload,
  ) {
    return {
      __moss_mobile_recite_nav: true,
      view: nextView,
      context_kind: nextContext.kind,
      context_unit_id: nextContext.unitId,
      context_name: nextContext.name,
      context_recite_date: nextContext.reciteDate || "",
      context_review_date: nextContext.reviewDate || "",
      selected_word: nextSelectedWord || null,
      unit_scroll_top: typeof nextUnitScrollTop === "number" ? Math.max(nextUnitScrollTop, 0) : 0,
      page_scroll_top: typeof nextPageScrollTop === "number" ? Math.max(nextPageScrollTop, 0) : 0,
      skip_unit_reload: !!nextSkipUnitReload,
    };
  }

  function parseNavState(state) {
    if (!state || !state.__moss_mobile_recite_nav) {
      return null;
    }
    const nextContext = {
      kind: state.context_kind === "forgotten"
        ? "forgotten"
        : (state.context_kind === "review" ? "review" : "unit"),
      unitId: Number(state.context_unit_id) || 0,
      name: state.context_name || "",
      reciteDate: state.context_recite_date || "",
      reviewDate: state.context_review_date || "",
    };
    return {
      view: state.view || "home",
      context: nextContext,
      selectedWord: state.selected_word || null,
      unitScrollTop: Math.max(Number(state.unit_scroll_top) || 0, 0),
      pageScrollTop: Math.max(Number(state.page_scroll_top) || 0, 0),
      skipUnitReload: !!state.skip_unit_reload,
    };
  }

  function pushNavState(
    nextView,
    nextContext,
    nextSelectedWord,
    nextUnitScrollTop,
    nextPageScrollTop,
    nextSkipUnitReload,
  ) {
    if (typeof window === "undefined") {
      return;
    }
    window.history.pushState(
      buildNavState(
        nextView,
        nextContext,
        nextSelectedWord,
        nextUnitScrollTop,
        nextPageScrollTop,
        nextSkipUnitReload,
      ),
      "",
      window.location.href,
    );
  }

  function replaceCurrentNavState(
    nextView,
    nextContext,
    nextSelectedWord,
    nextUnitScrollTop,
    nextPageScrollTop,
    nextSkipUnitReload,
  ) {
    if (typeof window === "undefined") {
      return;
    }
    window.history.replaceState(
      buildNavState(
        nextView,
        nextContext,
        nextSelectedWord,
        nextUnitScrollTop,
        nextPageScrollTop,
        nextSkipUnitReload,
      ),
      "",
      window.location.href,
    );
  }

  function currentUnitScrollTop() {
    if (unitScrollRef.current) {
      return Math.max(unitScrollRef.current.scrollTop || 0, 0);
    }
    return Math.max(unitScrollTopRef.current || 0, 0);
  }

  function currentPageScrollTop() {
    if (typeof window === "undefined") {
      return Math.max(pageScrollTopRef.current || 0, 0);
    }
    return Math.max(window.scrollY || 0, 0);
  }

  function applyNav(nav) {
    const nextView = nav.view || "home";
    const nextContext = nav.context || { kind: "unit", unitId: 0, name: "", reciteDate: "", reviewDate: "" };
    const nextSelectedWord = nav.selectedWord || null;
    const nextUnitScrollTop = Math.max(Number(nav.unitScrollTop) || 0, 0);
    const nextPageScrollTop = Math.max(Number(nav.pageScrollTop) || 0, 0);
    const nextContextKey = buildContextKey(nextContext);
    const shouldSkipReload = Boolean(
      nav.skipUnitReload
      && viewRef.current === "word"
      && contextKeyRef.current === nextContextKey
      && loadedContextKeyRef.current === nextContextKey,
    );
    setContext(nextContext);
    setSelectedWord(nextSelectedWord);
    setView(nextView);
    if (nextView === "unit") {
      pendingRestoreScrollTopRef.current = nextUnitScrollTop;
      pendingRestorePageScrollTopRef.current = nextPageScrollTop;
      if (shouldSkipReload) {
        setLoading(false);
      } else {
        loadUnitWords(nextContext.kind, nextContext.unitId, {
          clearBeforeLoad: true,
          reviewDate: nextContext.reviewDate,
        });
      }
    }
  }

  function goBack() {
    if (typeof window === "undefined") {
      return;
    }
    window.history.back();
  }

  useEffect(() => {
    if (onRootHomeChange) {
      onRootHomeChange(view === "home");
    }
  }, [view, onRootHomeChange]);

  useEffect(() => {
    viewRef.current = view;
    contextKeyRef.current = buildContextKey(context);
  }, [view, context.kind, context.unitId, context.reviewDate]);

  useEffect(() => {
    if (view === "unit") {
      setUnitMetaExpanded(false);
    }
  }, [view, context.kind, context.unitId, context.reviewDate]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const homeNav = {
      view: "home",
      context: { kind: "unit", unitId: 0, name: "", reciteDate: "", reviewDate: "" },
      selectedWord: null,
      unitScrollTop: 0,
      pageScrollTop: 0,
    };
    const homeState = buildNavState(
      homeNav.view,
      homeNav.context,
      homeNav.selectedWord,
      homeNav.unitScrollTop,
      homeNav.pageScrollTop,
      false,
    );
    window.history.replaceState(homeState, "", window.location.href);
    window.history.pushState(homeState, "", window.location.href);

    function onPopState(event) {
      const nav = parseNavState(event.state);
      if (!nav) {
        applyNav(homeNav);
        window.history.pushState(homeState, "", window.location.href);
        return;
      }
      applyNav(nav);
      if (nav.view === "home") {
        window.history.pushState(buildNavState("home", homeNav.context, null, 0, 0, false), "", window.location.href);
      }
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function loadUnitWords(kind, unitId, options = {}) {
    const clearBeforeLoad = options.clearBeforeLoad !== false;
    const reviewQuery = buildReviewQuery(options.reviewDate);
    let path = `/api/recite/units/${unitId}/words`;
    if (kind === "forgotten") {
      path = "/api/recite/forgotten/words";
    } else if (kind === "review") {
      path = `/api/recite/review/words${reviewQuery}`;
    }
    if (clearBeforeLoad) {
      setWords([]);
    }
    setLoading(true);
    setError("");
    return api(path)
      .then((data) => {
        setWords(data.words || []);
        if (kind === "review") {
          setReviewUnits(data.units || []);
        } else {
          setReviewUnits([]);
        }
        loadedContextKeyRef.current = buildContextKey({ kind, unitId, reviewDate: options.reviewDate || "" });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (view !== "unit" || loading) {
      return;
    }
    if (pendingRestoreScrollTopRef.current === null) {
      return;
    }
    const restoreTop = pendingRestoreScrollTopRef.current;
    window.requestAnimationFrame(() => {
      if (!unitScrollRef.current) {
        return;
      }
      unitScrollRef.current.scrollTop = restoreTop;
      unitScrollTopRef.current = restoreTop;
      const restorePageTop = Math.max(Number(pendingRestorePageScrollTopRef.current) || 0, 0);
      if (typeof window !== "undefined") {
        window.scrollTo(0, restorePageTop);
      }
      pageScrollTopRef.current = restorePageTop;
      pendingRestoreScrollTopRef.current = null;
      pendingRestorePageScrollTopRef.current = null;
    });
  }, [view, loading, words.length]);

  function openUnit(unit) {
    const nextContext = {
      kind: "unit",
      unitId: unit.id,
      name: unit.name,
      reciteDate: unit.recite_date || "",
      reviewDate: "",
    };
    setContext(nextContext);
    setSelectedWord(null);
    setView("unit");
    pendingRestoreScrollTopRef.current = 0;
    pendingRestorePageScrollTopRef.current = 0;
    loadUnitWords("unit", unit.id, { clearBeforeLoad: true, reviewDate: "" });
    pushNavState("unit", nextContext, null, 0, 0, false);
  }

  function openForgotten() {
    const nextContext = { kind: "forgotten", unitId: 0, name: "遗忘单词", reciteDate: "", reviewDate: "" };
    setContext(nextContext);
    setSelectedWord(null);
    setView("unit");
    pendingRestoreScrollTopRef.current = 0;
    pendingRestorePageScrollTopRef.current = 0;
    loadUnitWords("forgotten", 0, { clearBeforeLoad: true, reviewDate: "" });
    pushNavState("unit", nextContext, null, 0, 0, false);
  }

  function openReview() {
    const date = selectedReviewDate || ((reviewDates && reviewDates[0]) || "");
    if (onReviewDateChange && date && date !== selectedReviewDate) {
      onReviewDateChange(date);
    }
    const nextContext = { kind: "review", unitId: 0, name: "今日复习", reciteDate: "", reviewDate: date };
    setContext(nextContext);
    setSelectedWord(null);
    setView("unit");
    pendingRestoreScrollTopRef.current = 0;
    pendingRestorePageScrollTopRef.current = 0;
    loadUnitWords("review", 0, { clearBeforeLoad: true, reviewDate: date });
    pushNavState("unit", nextContext, null, 0, 0, false);
  }

  function loadQuizList(page = 1) {
    setQuizListLoading(true);
    setError("");
    return api(`/api/recite/quizzes?page=${Math.max(page, 1)}&page_size=20`)
      .then((data) => {
        setQuizRows(data.items || []);
        setQuizTotal(Number(data.total) || 0);
        setQuizPage(Math.max(Number(data.page) || page, 1));
        if (onQuizStateChange) {
          onQuizStateChange(Boolean(data.has_running));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setQuizListLoading(false));
  }

  function openQuizList() {
    setActiveQuizItem(null);
    setView("quiz_list");
    loadQuizList(1);
  }

  function forgetWord(word) {
    return api("/api/recite/forgotten/words", {
      method: "POST",
      body: { word },
    }).then(() => {
      if (notify) {
        notify("已添加到遗忘单词本");
      }
    });
  }

  function rememberWord(word) {
    return api("/api/recite/forgotten/words/remember", {
      method: "POST",
      body: { word },
    }).then(() => {
      setWords((prev) => prev.filter((row) => row.word !== word));
      if (notify) {
        notify("已标记为记住");
      }
    });
  }

  function changeReviewDate(nextDate) {
    const date = (nextDate || "").trim();
    if (!date) {
      return;
    }
    if (onReviewDateChange) {
      onReviewDateChange(date);
    }
    const nextContext = { ...context, kind: "review", name: "今日复习", reviewDate: date, reciteDate: "" };
    setContext(nextContext);
    setSelectedWord(null);
    pendingRestoreScrollTopRef.current = 0;
    pendingRestorePageScrollTopRef.current = 0;
    loadUnitWords("review", 0, { clearBeforeLoad: true, reviewDate: date });
    replaceCurrentNavState("unit", nextContext, null, 0, 0, false);
  }

  const opLabel = context.kind === "forgotten" ? "记住" : "忘记";
  const opAction = context.kind === "forgotten" ? rememberWord : forgetWord;
  const topMetaCountText = `共${words.length}个单词`;

  if (view === "quiz_dictation") {
    return (
      <MobileQuizPanel
        title={`${context.name} 听写`}
        type="dictation"
        startPayload={{
          type: "读写",
          source_kind: context.kind === "forgotten" ? "forgotten" : (context.kind === "review" ? "review" : "unit"),
          unit_id: context.kind === "unit" ? context.unitId : 0,
          review_date: context.kind === "review" ? (context.reviewDate || "") : "",
        }}
        operationLabel={opLabel}
        onOperation={opAction}
        defaultAccent={defaultAccent}
        onQuizStateChange={onQuizStateChange}
        onBack={goBack}
      />
    );
  }

  if (view === "quiz_spelling") {
    return (
      <MobileQuizPanel
        title={`${context.name} 默写`}
        type="spelling"
        startPayload={{
          type: "默写",
          source_kind: context.kind === "forgotten" ? "forgotten" : (context.kind === "review" ? "review" : "unit"),
          unit_id: context.kind === "unit" ? context.unitId : 0,
          review_date: context.kind === "review" ? (context.reviewDate || "") : "",
        }}
        operationLabel={opLabel}
        onOperation={opAction}
        defaultAccent={defaultAccent}
        onQuizStateChange={onQuizStateChange}
        onBack={goBack}
      />
    );
  }

  if (view === "quiz_item" && activeQuizItem) {
    const isSpelling = activeQuizItem.type === "默写";
    const itemOpLabel = activeQuizItem.source === "forgotten" ? "记住" : "忘记";
    const itemOpAction = activeQuizItem.source === "forgotten" ? rememberWord : forgetWord;
    const itemTitle = activeQuizItem.status === "进行中"
      ? `${activeQuizItem.title}（进行中）`
      : activeQuizItem.title;
    return (
      <MobileQuizPanel
        title={itemTitle}
        type={isSpelling ? "spelling" : "dictation"}
        quizId={activeQuizItem.id}
        operationLabel={itemOpLabel}
        onOperation={itemOpAction}
        defaultAccent={defaultAccent}
        readOnly={activeQuizItem.status !== "进行中"}
        onQuizStateChange={onQuizStateChange}
        onBack={() => {
          setActiveQuizItem(null);
          setView("quiz_list");
          loadQuizList(quizPage);
        }}
      />
    );
  }

  if (view === "quiz_list") {
    const totalPages = Math.max(Math.ceil(quizTotal / 20), 1);
    return (
      <div className="mobile-page-card">
        <div className="mobile-topbar">
          <button className="mobile-back-btn" onClick={() => setView("home")}>{"< 退出"}</button>
          <h2 className="mobile-page-title">测试列表</h2>
          <div />
        </div>
        {error && <div className="error">{error}</div>}
        {quizListLoading && <div className="helper-tip">加载中...</div>}
        {!quizListLoading && quizRows.length === 0 && <div className="helper-tip">暂无测试记录</div>}
        {!quizListLoading && quizRows.map((item) => (
          <div key={item.id} className="mobile-word-item">
            <div className="mobile-word-item-head mobile-word-item-head-finished">
              <button
                className="mobile-word-open-btn"
                onClick={() => {
                  setActiveQuizItem(item);
                  setView("quiz_item");
                }}
              >
                {item.status === "进行中" ? `${item.title}（进行中）` : item.title}
              </button>
              <div className="mobile-word-item-right-meta">
                <span className="mobile-word-item-no-inline">{item.created_at}</span>
                <span className={`mobile-word-item-status ${item.status === "进行中" ? "operated" : "wrong"}`}>
                  {item.status}
                </span>
              </div>
            </div>
            <div className="mobile-word-item-mean">
              <div className="mobile-word-item-mean-line">
                共{item.stats.total}个，已测{item.stats.tested}个，正确{item.stats.correct}个，错误{item.stats.wrong}个，忘记{item.stats.forgotten}个
              </div>
            </div>
          </div>
        ))}
        {!quizListLoading && totalPages > 1 && (
          <div className="dictation-actions">
            <button className="btn secondary" disabled={quizPage <= 1} onClick={() => loadQuizList(quizPage - 1)}>上一页</button>
            <div>{quizPage}/{totalPages}</div>
            <button className="btn secondary" disabled={quizPage >= totalPages} onClick={() => loadQuizList(quizPage + 1)}>下一页</button>
          </div>
        )}
      </div>
    );
  }

  if (view === "word" && selectedWord) {
    return (
      <div className="mobile-page-card">
        <div className="mobile-topbar">
          <button className="mobile-back-btn" onClick={goBack}>{"< 退出"}</button>
          <div />
          <a
            className="desc-op-link"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              opAction(selectedWord.word).catch((err) => setError(err.message));
            }}
          >
            {opLabel}
          </a>
        </div>
        <h2 className="mobile-page-title mobile-word-page-title">{selectedWord.word}</h2>
        <MobileWordDetailBody row={selectedWord} playAudio={playAudio} />
      </div>
    );
  }

  if (view === "unit") {
    return (
      <>
        <div className="mobile-page-card mobile-unit-page">
          <div className="mobile-topbar mobile-unit-topbar">
            <button className="mobile-back-btn" onClick={goBack}>{"< 退出"}</button>
            <h2 className="mobile-page-title">{context.name}</h2>
            <div className="mobile-unit-meta">
              <button
                className="mobile-unit-meta-toggle"
                onClick={() => setUnitMetaExpanded((v) => !v)}
              >
                <span>{topMetaCountText}</span>
                <span className="mobile-unit-meta-arrow">{unitMetaExpanded ? "\u25B2" : "\u25BC"}</span>
              </button>
              {unitMetaExpanded && (
                <div className="mobile-unit-meta-detail">
                  {context.kind === "review" && (
                    <select
                      className="input mobile-review-date-select"
                      value={context.reviewDate || selectedReviewDate || ""}
                      onChange={(e) => changeReviewDate(e.target.value)}
                    >
                      {(reviewDates || []).map((date) => (
                        <option key={date} value={date}>{date}</option>
                      ))}
                    </select>
                  )}
                  {context.kind === "unit" && (
                    <div>背诵时间：{formatReciteDateText(context.reciteDate)}</div>
                  )}
                  {context.kind === "review" ? (
                    <>
                      <div>共{words.length}个单词，包含：</div>
                      {reviewUnits.length === 0 ? (
                        <div>-</div>
                      ) : reviewUnits.map((item) => (
                        <div key={item.unit_id}>
                          {item.name},共{item.word_count}个单词，记忆时间 {formatReciteDateText(item.recite_date)}，距离今天{item.distance_days}天
                        </div>
                      ))}
                    </>
                  ) : (
                    <div>{topMetaCountText}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {error && <div className="error">{error}</div>}
          <div
            className="mobile-unit-scroll"
            ref={unitScrollRef}
            onScroll={(e) => {
              unitScrollTopRef.current = e.currentTarget.scrollTop || 0;
            }}
          >
            {loading && <div className="helper-tip">加载中...</div>}
            {!loading && words.length === 0 && <div className="helper-tip">暂无单词</div>}
            {words.map((row, idx) => {
              const meaningRows = formatMeaningLines(row.parts);
              return (
                <div key={`${row.word}-${idx}`} className="mobile-word-item">
                  <div className="mobile-word-item-head">
                    <button
                      className="mobile-word-open-btn"
                      onClick={() => {
                        const scrollTop = currentUnitScrollTop();
                        const pageScrollTop = currentPageScrollTop();
                        replaceCurrentNavState("unit", context, null, scrollTop, pageScrollTop, true);
                        setSelectedWord(row);
                        setView("word");
                        pushNavState("word", context, row, scrollTop, pageScrollTop, false);
                      }}
                    >
                      {row.word}
                    </button>
                    <span className="mobile-word-item-no">#{idx + 1}</span>
                  </div>
                  <div className="mobile-word-item-pron">
                    <a
                      className="mobile-pron-link"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        playAudio(getEnglishAudio(row));
                      }}
                    >
                      英 [{row.ph_en || "-"}]
                    </a>
                    <a
                      className="mobile-pron-link"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        playAudio(getAmericanAudio(row) || getEnglishAudio(row));
                      }}
                    >
                      美 [{row.ph_am || "-"}]
                    </a>
                  </div>
                  <div className="mobile-word-item-mean">
                    {meaningRows.length > 0 ? meaningRows.map((line, lineIdx) => (
                      <div key={`${row.word}-mean-${lineIdx}`} className="mobile-word-item-mean-line">{line}</div>
                    )) : "-"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <nav className="mobile-bottom-nav mobile-unit-nav">
          <button
            className="mobile-bottom-btn"
            onClick={() => {
              const scrollTop = currentUnitScrollTop();
              const pageScrollTop = currentPageScrollTop();
              replaceCurrentNavState("unit", context, null, scrollTop, pageScrollTop, false);
              setSelectedWord(null);
              setView("quiz_dictation");
              pushNavState("quiz_dictation", context, null, scrollTop, pageScrollTop, false);
            }}
          >
            听写
          </button>
          <button
            className="mobile-bottom-btn"
            onClick={() => {
              const scrollTop = currentUnitScrollTop();
              const pageScrollTop = currentPageScrollTop();
              replaceCurrentNavState("unit", context, null, scrollTop, pageScrollTop, false);
              setSelectedWord(null);
              setView("quiz_spelling");
              pushNavState("quiz_spelling", context, null, scrollTop, pageScrollTop, false);
            }}
          >
            默写
          </button>
        </nav>
      </>
    );
  }

  return (
    <div className="mobile-page-card">
      <h2 className="mobile-page-title">背单词首页</h2>
      <ul className="mobile-home-list">
        <li>
          <button className="mobile-home-item" onClick={openForgotten}>遗忘单词</button>
        </li>
        <li>
          <button className="mobile-home-item" onClick={openQuizList}>
            测试列表{quizHasRunning ? "（进行中）" : ""}
          </button>
        </li>
        <li>
          <button className="mobile-home-item" onClick={openReview}>今日复习</button>
        </li>
        {units.map((unit) => (
          <li key={unit.id}>
            <button className="mobile-home-item" onClick={() => openUnit(unit)}>{unit.name}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MobileTodoPanel() {
  const [text, setText] = useState("正在加载...");

  useEffect(() => {
    api("/api/todo/placeholder")
      .then((data) => setText(data.message || "todo list 功能待开发"))
      .catch((err) => setText(err.message));
  }, []);

  return (
    <div className="mobile-page-card">
      <h2 className="mobile-page-title">Todo List</h2>
      <p>{text}</p>
    </div>
  );
}

function SidebarRecite({
  units,
  selectedType,
  selectedUnitId,
  onSelectUnit,
  onSelectForgotten,
  onSelectQuizList,
  onSelectReview,
  quizHasRunning,
  onCreateUnit,
  onRenameUnit,
  onDeleteUnit,
  onReorderUnits,
  searchKeyword,
  onSearchKeywordChange,
  createName,
  onCreateNameChange,
  createReciteDate,
  onCreateReciteDateChange,
}) {
  const [editingUnitId, setEditingUnitId] = useState(0);
  const [editingName, setEditingName] = useState("");
  const [editingReciteDate, setEditingReciteDate] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [draggingUnitId, setDraggingUnitId] = useState(0);
  const [dropUnitId, setDropUnitId] = useState(0);
  const [error, setError] = useState("");
  const canReorder = searchKeyword.trim() === "" && editingUnitId === 0;

  function startEdit(unit) {
    setError("");
    setEditingUnitId(unit.id);
    setEditingName(unit.name);
    setEditingReciteDate(unit.recite_date || "");
  }

  function saveEdit(unitId) {
    setError("");
    onRenameUnit(unitId, editingName, editingReciteDate)
      .then(() => {
        setEditingUnitId(0);
        setEditingName("");
        setEditingReciteDate("");
      })
      .catch((err) => setError(err.message));
  }

  function removeUnit(unit) {
    if (!onDeleteUnit) {
      return;
    }
    const label = (unit && unit.name) ? unit.name : "该单元";
    if (!window.confirm(`确认删除单元「${label}」吗？`)) {
      return;
    }
    setError("");
    onDeleteUnit(unit.id)
      .then(() => {
        setEditingUnitId(0);
        setEditingName("");
        setEditingReciteDate("");
      })
      .catch((err) => setError(err.message));
  }

  function submitCreate() {
    Promise.resolve(onCreateUnit())
      .then(() => {
        setShowCreate(false);
      })
      .catch(() => {});
  }

  function reorderByDrag(fromUnitID, toUnitID) {
    if (!canReorder || !onReorderUnits || fromUnitID <= 0 || toUnitID <= 0 || fromUnitID === toUnitID) {
      return;
    }

    const currentIDs = units.map((item) => item.id);
    const fromIdx = currentIDs.indexOf(fromUnitID);
    const toIdx = currentIDs.indexOf(toUnitID);
    if (fromIdx < 0 || toIdx < 0) {
      return;
    }
    const nextIDs = currentIDs.slice();
    const moved = nextIDs.splice(fromIdx, 1)[0];
    nextIDs.splice(toIdx, 0, moved);

    setError("");
    Promise.resolve(onReorderUnits(nextIDs))
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setDraggingUnitId(0);
        setDropUnitId(0);
      });
  }

  return (
    <div className="sidebar-body">
      <div>
        <div className="side-title-row">
          <h3 className="side-title">背单词</h3>
          <button
            className="icon-btn"
            title={showCreate ? "收起添加单元" : "添加单元"}
            onClick={() => setShowCreate((v) => !v)}
          >
            +
          </button>
        </div>
        {showCreate && (
          <div className="sidebar-block create-row">
            <input
              className="input side-input"
              placeholder="新单元名称"
              value={createName}
              onChange={(e) => onCreateNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  submitCreate();
                }
              }}
            />
            <input
              className="input side-date-input"
              type="date"
              value={createReciteDate || ""}
              onChange={(e) => onCreateReciteDateChange(e.target.value)}
            />
            <button className="btn" onClick={submitCreate}>添加</button>
          </div>
        )}
        <div className="sidebar-block">
          <input
            className="input side-input"
            placeholder="搜索单元"
            value={searchKeyword}
            onChange={(e) => onSearchKeywordChange(e.target.value)}
          />
        </div>
      </div>

      <ul className="unit-list side-unit-list">
        <li className="unit-row-wrap">
          <div className="unit-item-row">
            <button
              className={`unit-item unit-main-btn ${selectedType === "forgotten" ? "active" : ""}`}
              onClick={onSelectForgotten}
            >
              遗忘单词
            </button>
          </div>
        </li>
        <li className="unit-row-wrap">
          <div className="unit-item-row">
            <button
              className={`unit-item unit-main-btn ${selectedType === "quiz_list" ? "active" : ""}`}
              onClick={onSelectQuizList}
            >
              测试列表{quizHasRunning ? "（进行中）" : ""}
            </button>
          </div>
        </li>
        <li className="unit-row-wrap">
          <div className="unit-item-row">
            <button
              className={`unit-item unit-main-btn ${selectedType === "review" ? "active" : ""}`}
              onClick={onSelectReview}
            >
              今日复习
            </button>
          </div>
        </li>
        {units.map((unit) => (
          <li
            key={unit.id}
            className={`unit-row-wrap ${canReorder ? "sortable" : ""} ${dropUnitId === unit.id && draggingUnitId !== unit.id ? "drag-over" : ""}`}
            draggable={canReorder}
            onDragStart={(e) => {
              if (!canReorder) {
                return;
              }
              setDraggingUnitId(unit.id);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", String(unit.id));
            }}
            onDragOver={(e) => {
              if (!canReorder) {
                return;
              }
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (draggingUnitId > 0 && draggingUnitId !== unit.id) {
                setDropUnitId(unit.id);
              }
            }}
            onDrop={(e) => {
              if (!canReorder) {
                return;
              }
              e.preventDefault();
              const raw = e.dataTransfer.getData("text/plain");
              const fromUnitID = raw ? Number(raw) : draggingUnitId;
              reorderByDrag(fromUnitID, unit.id);
            }}
            onDragEnd={() => {
              setDraggingUnitId(0);
              setDropUnitId(0);
            }}
          >
            <div className="unit-item-wrap">
              <button
                className={`unit-item unit-main-btn ${selectedType === "unit" && selectedUnitId === unit.id ? "active" : ""}`}
                onClick={() => onSelectUnit(unit.id)}
              >
                <span className="unit-item-title">{unit.name}</span>
                <span className="unit-item-date">{unit.recite_date || "-"}</span>
              </button>
              <button
                className="unit-edit-float-btn"
                title="编辑单元名"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  startEdit(unit);
                }}
              >
                &#9998;
              </button>
            </div>
            {editingUnitId === unit.id && (
              <div className="unit-edit-row">
                <input
                  className="input side-input"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      saveEdit(unit.id);
                    }
                  }}
                />
                <input
                  className="input side-date-input"
                  type="date"
                  value={editingReciteDate}
                  onChange={(e) => setEditingReciteDate(e.target.value)}
                />
                <button className="btn" onClick={() => saveEdit(unit.id)}>保存</button>
                <button
                  className="btn secondary"
                  onClick={() => {
                    setEditingUnitId(0);
                    setEditingReciteDate("");
                  }}
                >
                  取消
                </button>
                <button className="btn danger" onClick={() => removeUnit(unit)}>
                  删除
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {canReorder && units.length > 1 && <div className="helper-tip">可拖拽单元排序</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

function SidebarTodo() {
  return (
    <div className="sidebar-body">
      <h3 className="side-title">Todo List</h3>
      <p className="helper-tip">当前版本只保留入口与占位内容。</p>
    </div>
  );
}

function App() {
  const isMobile = useIsMobile(960);
  const [mode, setMode] = useState("recite");
  const [units, setUnits] = useState([]);
  const [selectedReciteType, setSelectedReciteType] = useState("unit");
  const [selectedUnitId, setSelectedUnitId] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [createName, setCreateName] = useState("");
  const [createReciteDate, setCreateReciteDate] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [toast, setToast] = useState({ visible: false, text: "", ts: 0 });
  const [showMobileRootNav, setShowMobileRootNav] = useState(true);
  const [defaultAccent, setDefaultAccent] = useState("en");
  const [reviewDates, setReviewDates] = useState([]);
  const [selectedReviewDate, setSelectedReviewDate] = useState("");
  const [quizHasRunning, setQuizHasRunning] = useState(false);

  function notify(text) {
    setToast({ visible: true, text, ts: Date.now() });
  }

  useEffect(() => {
    if (!toast.visible) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 1400);
    return () => clearTimeout(timer);
  }, [toast.visible, toast.ts]);

  function loadUnits() {
    api("/api/recite/units")
      .then((data) => {
        const rows = data.units || [];
        setUnits(rows);
        if (rows.length === 0) {
          setSelectedUnitId(0);
          setSelectedReciteType("forgotten");
          return;
        }
        if (selectedReciteType === "unit") {
          if (!rows.some((x) => x.id === selectedUnitId)) {
            setSelectedUnitId(rows[0].id);
          }
          return;
        }
        if (selectedUnitId <= 0) {
          setSelectedUnitId(rows[0].id);
        }
      })
      .catch((err) => setGlobalError(err.message));
  }

  useEffect(() => {
    loadUnits();
  }, []);

  function loadReviewDates() {
    api("/api/recite/review/dates?recent_days=7")
      .then((data) => {
        const dates = data.dates || [];
        setReviewDates(dates);
        if (dates.length === 0) {
          setSelectedReviewDate("");
          return;
        }
        setSelectedReviewDate((prev) => {
          if (prev && dates.includes(prev)) {
            return prev;
          }
          return dates[0];
        });
      })
      .catch((err) => setGlobalError(err.message));
  }

  useEffect(() => {
    loadReviewDates();
  }, []);

  function loadQuizRunning() {
    api("/api/recite/quizzes/running")
      .then((data) => {
        setQuizHasRunning(Boolean(data.has_running));
      })
      .catch(() => {
        setQuizHasRunning(false);
      });
  }

  useEffect(() => {
    loadQuizRunning();
  }, []);

  useEffect(() => {
    api("/api/recite/config")
      .then((data) => {
        const accent = data && data.config && data.config.default_accent === "am" ? "am" : "en";
        setDefaultAccent(accent);
      })
      .catch(() => {
        setDefaultAccent("en");
      });
  }, []);

  const filteredUnits = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) {
      return units;
    }
    return units.filter((unit) => unit.name.toLowerCase().includes(keyword));
  }, [units, searchKeyword]);

  const selectedUnit = useMemo(
    () => units.find((unit) => unit.id === selectedUnitId) || null,
    [units, selectedUnitId],
  );

  function createUnit() {
    setGlobalError("");
    return api("/api/recite/units", {
      method: "POST",
      body: { name: createName, recite_date: createReciteDate || "" },
    })
      .then((data) => {
        const newUnit = data.unit;
        setCreateName("");
        setCreateReciteDate("");
        loadUnits();
        if (newUnit && newUnit.id) {
          setSelectedReciteType("unit");
          setSelectedUnitId(newUnit.id);
        }
      })
      .catch((err) => {
        setGlobalError(err.message);
        throw err;
      });
  }

  function renameUnit(unitId, name, reciteDate) {
    setGlobalError("");
    const nextName = (name || "").trim();
    if (!nextName) {
      return Promise.reject(new Error("单元名称不能为空"));
    }
    return api(`/api/recite/units/${unitId}/name`, {
      method: "PUT",
      body: { name: nextName, recite_date: reciteDate || "" },
    }).then(() => {
      setUnits((prev) => prev.map((u) => (
        u.id === unitId ? { ...u, name: nextName, recite_date: reciteDate || "" } : u
      )));
    });
  }

  function reorderUnits(unitIDs) {
    setGlobalError("");
    return api("/api/recite/units/order", {
      method: "PUT",
      body: { unit_ids: unitIDs },
    }).then(() => {
      setUnits((prev) => {
        const byID = new Map(prev.map((item) => [item.id, item]));
        const next = [];
        const seen = new Set();
        unitIDs.forEach((id) => {
          const row = byID.get(id);
          if (row) {
            next.push(row);
            seen.add(id);
          }
        });
        prev.forEach((item) => {
          if (!seen.has(item.id)) {
            next.push(item);
          }
        });
        return next;
      });
    });
  }

  function deleteUnit(unitId) {
    setGlobalError("");
    return api(`/api/recite/units/${unitId}`, { method: "DELETE" })
      .then(() => {
        setUnits((prev) => {
          const next = prev.filter((u) => u.id !== unitId);
          if (selectedReciteType === "unit" && selectedUnitId === unitId) {
            if (next.length > 0) {
              setSelectedUnitId(next[0].id);
            } else {
              setSelectedUnitId(0);
              setSelectedReciteType("forgotten");
            }
          }
          return next;
        });
        loadUnits();
      })
      .catch((err) => {
        setGlobalError(err.message);
        throw err;
      });
  }

  if (isMobile) {
    const shouldShowBottomNav = mode === "todo" || (mode === "recite" && showMobileRootNav);
    return (
      <div className="mobile-shell">
        <main className="mobile-main">
          {globalError && <div className="error global-error">{globalError}</div>}
          {mode === "recite" && (
            <MobileReciteRoot
              units={units}
              notify={notify}
              onRootHomeChange={setShowMobileRootNav}
              defaultAccent={defaultAccent}
              reviewDates={reviewDates}
              selectedReviewDate={selectedReviewDate}
              onReviewDateChange={setSelectedReviewDate}
              quizHasRunning={quizHasRunning}
              onQuizStateChange={loadQuizRunning}
            />
          )}
          {mode === "todo" && <MobileTodoPanel />}
        </main>

        {shouldShowBottomNav && (
          <nav className="mobile-bottom-nav">
            <button
              className={`mobile-bottom-btn ${mode === "recite" ? "active" : ""}`}
              onClick={() => setMode("recite")}
            >
              背单词
            </button>
            <button
              className={`mobile-bottom-btn ${mode === "todo" ? "active" : ""}`}
              onClick={() => setMode("todo")}
            >
              todo
            </button>
          </nav>
        )}

        <div className={`toast-tip ${toast.visible ? "show" : ""}`}>{toast.text}</div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <div className="layout-shell unified-layout">
        <aside className="left-col sidebar-unified">
          {mode === "recite" ? (
            <SidebarRecite
              units={filteredUnits}
              selectedType={selectedReciteType}
              selectedUnitId={selectedUnitId}
              onSelectUnit={(unitId) => {
                setSelectedReciteType("unit");
                setSelectedUnitId(unitId);
              }}
              onSelectForgotten={() => setSelectedReciteType("forgotten")}
              onSelectQuizList={() => setSelectedReciteType("quiz_list")}
              onSelectReview={() => setSelectedReciteType("review")}
              quizHasRunning={quizHasRunning}
              onCreateUnit={createUnit}
              onRenameUnit={renameUnit}
              onDeleteUnit={deleteUnit}
              onReorderUnits={reorderUnits}
              searchKeyword={searchKeyword}
              onSearchKeywordChange={setSearchKeyword}
              createName={createName}
              onCreateNameChange={setCreateName}
              createReciteDate={createReciteDate}
              onCreateReciteDateChange={setCreateReciteDate}
            />
          ) : (
            <SidebarTodo />
          )}

          <div className="side-footer">
            <button
              className={`menu-btn side-switch ${mode === "recite" ? "active-switch" : ""}`}
              onClick={() => setMode("recite")}
            >
              背单词
            </button>
            <button
              className={`menu-btn side-switch todo ${mode === "todo" ? "active-switch" : ""}`}
              onClick={() => setMode("todo")}
            >
              todo list
            </button>
          </div>
        </aside>

        <main className="right-col right-unified">
          {globalError && <div className="error global-error">{globalError}</div>}

          {mode === "todo" && <TodoPanel />}

          {mode === "recite" && selectedReciteType === "forgotten" && (
            <ForgottenPanel notify={notify} defaultAccent={defaultAccent} onQuizStateChange={loadQuizRunning} />
          )}

          {mode === "recite" && selectedReciteType === "quiz_list" && (
            <QuizListPanel notify={notify} defaultAccent={defaultAccent} onQuizStateChange={loadQuizRunning} />
          )}

          {mode === "recite" && selectedReciteType === "review" && (
            <ReviewPanel
              notify={notify}
              defaultAccent={defaultAccent}
              reviewDates={reviewDates}
              selectedReviewDate={selectedReviewDate}
              onReviewDateChange={setSelectedReviewDate}
              onQuizStateChange={loadQuizRunning}
            />
          )}

          {mode === "recite" && selectedReciteType === "unit" && !selectedUnit && (
            <div className="right-panel-inner">
              <h2>请选择单元</h2>
              <p className="helper-tip">左侧可以添加单元、搜索单元并点击进入内容。</p>
            </div>
          )}

          {mode === "recite" && selectedReciteType === "unit" && selectedUnit && (
            <ReciteUnitPanel
              key={selectedUnit.id}
              unit={selectedUnit}
              notify={notify}
              defaultAccent={defaultAccent}
              onQuizStateChange={loadQuizRunning}
            />
          )}
        </main>
      </div>
      <div className={`toast-tip ${toast.visible ? "show" : ""}`}>{toast.text}</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
