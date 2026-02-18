const { useEffect, useMemo, useRef, useState } = React;

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

  function playAudio(url) {
    if (!url) {
      return;
    }
    ref.current.pause();
    ref.current.src = url;
    ref.current.currentTime = 0;
    ref.current.play().catch(() => {});
  }

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
                            onOperation(row.word);
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

function DictationPanel({ title, fetchPath, onBack, operationLabel, onOperation, removeOnOperationSuccess }) {
  const playAudio = useAudioPlayer();
  const [words, setWords] = useState([]);
  const [index, setIndex] = useState(-1);
  const [showAnswer, setShowAnswer] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [resultMap, setResultMap] = useState({});
  const [error, setError] = useState("");

  function wordKey(word) {
    return normalizeWordText(word);
  }

  function resultMeta(status) {
    if (status === "correct") {
      return { text: "正确", className: "correct" };
    }
    if (status === "forgotten") {
      return { text: "忘记", className: "forgotten" };
    }
    return { text: "错误", className: "wrong" };
  }

  const stats = useMemo(() => {
    const total = words.length;
    let correct = 0;
    let forgotten = 0;
    words.forEach((row) => {
      const status = resultMap[wordKey(row.word)];
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
    api(fetchPath)
      .then((data) => {
        setWords(data.words || []);
        setIndex(-1);
        setShowAnswer(false);
        setInputValue("");
        setResultMap({});
        setError("");
      })
      .catch((err) => setError(err.message));
  }, [fetchPath]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== "Meta") {
        return;
      }
      if (index < 0 || index >= words.length) {
        return;
      }
      const row = words[index];
      playAudio(row.am_audio || row.en_audio);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, words, playAudio]);

  function submitCurrentInput() {
    if (index < 0 || index >= words.length) {
      return;
    }
    const row = words[index];
    const key = wordKey(row.word);
    if (resultMap[key] === "forgotten") {
      return;
    }
    const ok = normalizeWordText(inputValue) === normalizeWordText(row.word);
    setResultMap((prev) => ({ ...prev, [key]: ok ? "correct" : "wrong" }));
  }

  function readNext() {
    if (showAnswer) {
      return;
    }
    if (words.length === 0) {
      setShowAnswer(true);
      return;
    }
    if (index < 0) {
      setIndex(0);
      setInputValue("");
      playAudio(words[0].am_audio || words[0].en_audio);
      return;
    }
    submitCurrentInput();
    setInputValue("");
    if (index + 1 >= words.length) {
      setShowAnswer(true);
      return;
    }
    const nextIndex = index + 1;
    const row = words[nextIndex];
    setIndex(nextIndex);
    playAudio(row.am_audio || row.en_audio);
  }

  function repeatCurrent() {
    if (index < 0 || index >= words.length) {
      return;
    }
    const row = words[index];
    playAudio(row.am_audio || row.en_audio);
  }

  function operateCurrentAndSkip() {
    if (index < 0 || index >= words.length || !onOperation) {
      return;
    }
    const row = words[index];
    onOperation(row.word)
      .then(() => {
        setResultMap((prev) => ({ ...prev, [wordKey(row.word)]: "forgotten" }));
        setInputValue("");
        if (index + 1 >= words.length) {
          setShowAnswer(true);
          return;
        }
        const nextIndex = index + 1;
        const next = words[nextIndex];
        setIndex(nextIndex);
        playAudio(next.am_audio || next.en_audio);
      })
      .catch((err) => setError(err.message));
  }

  function handleOperation(word) {
    if (!onOperation) {
      return;
    }
    onOperation(word)
      .then(() => {
        setResultMap((prev) => ({ ...prev, [wordKey(word)]: "forgotten" }));
        if (removeOnOperationSuccess) {
          setWords((prev) => {
            const next = prev.filter((item) => item.word !== word);
            setIndex((old) => {
              if (next.length === 0) {
                return -1;
              }
              if (old < 0) {
                return -1;
              }
              return Math.min(old, next.length - 1);
            });
            return next;
          });
          setResultMap((prev) => {
            const next = { ...prev };
            delete next[wordKey(word)];
            return next;
          });
        }
      })
      .catch((err) => setError(err.message));
  }

  return (
    <div className="right-panel-inner">
      <h2>{title}</h2>
      <div className="dictation-box">
        <div className="progress">
          当前进度：{Math.max(index + 1, 0)} / {words.length}
        </div>
        <div className="dictation-input-row">
          <input
            className="input dictation-input"
            placeholder="输入听到的单词"
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
          <button className="btn brand" onClick={readNext}>读下一单词</button>
          <button className="btn" onClick={repeatCurrent}>重复当前单词</button>
          <button className="btn" onClick={operateCurrentAndSkip}>{operationLabel}</button>
          <button className="btn secondary" onClick={() => setShowAnswer((v) => !v)}>
            {showAnswer ? "隐藏答案" : "显示答案"}
          </button>
          <button className="btn secondary" onClick={onBack}>返回列表</button>
        </div>
        {error && <div className="error">{error}</div>}
      </div>
      {showAnswer && (
        <div style={{ marginTop: "14px" }}>
          <div className="quiz-stat-line">
            测验结果：共听写单词 {stats.total} 个，正确 {stats.correct} 个，错误 {stats.wrong} 个，忘记 {stats.forgotten} 个
          </div>
          <WordTable
            rows={words}
            playAudio={playAudio}
            operationLabel={operationLabel}
            onOperation={handleOperation}
            resultResolver={(row) => {
              const key = wordKey(row.word);
              const status = resultMap[key] || "wrong";
              return resultMeta(status);
            }}
          />
        </div>
      )}
    </div>
  );
}

function SpellingPanel({ title, fetchPath, onBack, operationLabel, onOperation, removeOnOperationSuccess }) {
  const playAudio = useAudioPlayer();
  const [words, setWords] = useState([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [inputMap, setInputMap] = useState({});
  const inputRefs = useRef([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api(fetchPath)
      .then((data) => {
        setWords(data.words || []);
        setShowAnswer(false);
        setInputMap({});
        setError("");
      })
      .catch((err) => setError(err.message));
  }, [fetchPath]);

  const stats = useMemo(() => {
    const total = words.length;
    let correct = 0;
    words.forEach((row) => {
      if (normalizeWordText(inputMap[row.word]) === normalizeWordText(row.word)) {
        correct += 1;
      }
    });
    return { total, correct, wrong: Math.max(total - correct, 0) };
  }, [words, inputMap]);

  function spellingResultMeta(row) {
    const ok = normalizeWordText(inputMap[row.word]) === normalizeWordText(row.word);
    return ok
      ? { text: "正确", className: "correct" }
      : { text: "错误", className: "wrong" };
  }

  function focusInputByIndex(nextIdx) {
    if (nextIdx < 0 || nextIdx >= words.length) {
      return;
    }
    const target = inputRefs.current[nextIdx];
    if (target) {
      target.focus();
      target.select();
    }
  }

  function handleOperation(word) {
    if (!onOperation) {
      return;
    }
    onOperation(word)
      .then(() => {
        if (removeOnOperationSuccess) {
          setWords((prev) => prev.filter((item) => item.word !== word));
          setInputMap((prev) => {
            const next = { ...prev };
            delete next[word];
            return next;
          });
        }
      })
      .catch((err) => setError(err.message));
  }

  return (
    <div className="right-panel-inner">
      <h2>{title}</h2>
      <div className="dictation-box">
        <div className="dictation-actions">
          <button className="btn brand" onClick={() => setShowAnswer((v) => !v)}>
            {showAnswer ? "隐藏答案" : "查看答案"}
          </button>
          <button className="btn secondary" onClick={onBack}>返回列表</button>
        </div>
        {error && <div className="error">{error}</div>}
      </div>

      {showAnswer && (
        <div className="quiz-stat-line">
          测验结果：共默写单词 {stats.total} 个，正确 {stats.correct} 个，错误 {stats.wrong} 个
        </div>
      )}

      <table className="word-table" style={{ marginTop: "14px" }}>
        <thead>
          <tr>
            <th style={{ width: "64px" }}>编号</th>
            <th>释义</th>
            <th style={{ width: "220px" }}>输入</th>
            {showAnswer && <th style={{ width: "92px" }}>结果</th>}
            {showAnswer && <th style={{ width: "180px" }}>单词</th>}
            {showAnswer && <th style={{ width: "220px" }}>音标</th>}
            {showAnswer && operationLabel && <th style={{ width: "100px" }}>操作</th>}
          </tr>
        </thead>
        <tbody>
          {words.map((row, idx) => (
            <tr key={`${row.word}-${idx}`}>
              <td>{idx + 1}</td>
              <td><MeaningCell parts={row.parts} /></td>
              <td>
                <input
                  className="input spelling-input"
                  value={inputMap[row.word] || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setInputMap((prev) => ({ ...prev, [row.word]: value }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      focusInputByIndex(idx + 1);
                    }
                  }}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                />
              </td>
              {showAnswer && (
                <td>
                  <span className={`quiz-result-text ${spellingResultMeta(row).className}`}>
                    {spellingResultMeta(row).text}
                  </span>
                </td>
              )}
              {showAnswer && <td>{row.word}</td>}
              {showAnswer && (
                <td>
                  <div className="yinbiao-row">
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
                  </div>
                  <div className="yinbiao-row">
                    <span>美音：[{row.ph_am || "-"}]</span>
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
                </td>
              )}
              {showAnswer && operationLabel && (
                <td>
                  <button className="btn" onClick={() => handleOperation(row.word)}>
                    {operationLabel}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReciteUnitPanel({ unit, notify }) {
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
        playAudio(data.word.en_audio_url || data.word.am_audio_url);
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
        fetchPath={`/api/recite/units/${unit.id}/dictation`}
        operationLabel="忘记"
        onOperation={forgetWord}
        removeOnOperationSuccess={false}
        onBack={() => setView("detail")}
      />
    );
  }
  if (view === "spelling") {
    return (
      <SpellingPanel
        title="默写单词"
        fetchPath={`/api/recite/units/${unit.id}/dictation`}
        operationLabel="忘记"
        onOperation={forgetWord}
        removeOnOperationSuccess={false}
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

      <section>
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

function ForgottenPanel({ notify }) {
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
        fetchPath="/api/recite/forgotten/dictation"
        operationLabel="记住"
        onOperation={rememberWord}
        removeOnOperationSuccess={true}
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
        fetchPath="/api/recite/forgotten/dictation"
        operationLabel="记住"
        onOperation={rememberWord}
        removeOnOperationSuccess={true}
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
  fetchPath,
  onBack,
  operationLabel,
  onOperation,
}) {
  const playAudio = useAudioPlayer();
  const inputRef = useRef(null);
  const [words, setWords] = useState([]);
  const [index, setIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [operationCount, setOperationCount] = useState(0);
  const [operatedCurrent, setOperatedCurrent] = useState(false);
  const current = words[index] || null;

  useEffect(() => {
    setLoading(true);
    setError("");
    api(fetchPath)
      .then((data) => {
        const rows = data.words || [];
        setWords(rows);
        setIndex(0);
        setInputValue("");
        setRevealed(false);
        setResult("");
        setFinished(rows.length === 0);
        setCorrectCount(0);
        setWrongCount(0);
        setOperationCount(0);
        setOperatedCurrent(false);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [fetchPath]);

  useEffect(() => {
    if (type === "dictation" && current && !revealed) {
      playAudio(current.am_audio || current.en_audio);
    }
  }, [type, current && current.word, revealed]);

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
      return;
    }
    if (index + 1 >= words.length) {
      setFinished(true);
      return;
    }
    setIndex((prev) => prev + 1);
    setInputValue("");
    setRevealed(false);
    setResult("");
    setOperatedCurrent(false);
  }

  function submitOrNext() {
    if (!current) {
      return;
    }
    if (revealed) {
      goNext();
      return;
    }
    const ok = normalizeWordText(inputValue) === normalizeWordText(current.word);
    if (ok) {
      setCorrectCount((prev) => prev + 1);
    } else {
      setWrongCount((prev) => prev + 1);
    }
    setResult(ok ? "correct" : "wrong");
    setRevealed(true);
    if (type === "spelling") {
      playAudio(current.am_audio || current.en_audio);
    }
  }

  function handleOperation() {
    if (!current || !onOperation) {
      return;
    }
    onOperation(current.word)
      .then(() => {
        if (!operatedCurrent) {
          setOperationCount((prev) => prev + 1);
          setOperatedCurrent(true);
        }
        setRevealed(true);
      })
      .catch((err) => setError(err.message));
  }

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

  if (finished || !current) {
    return (
      <div className="mobile-page-card">
        <div className="mobile-topbar">
          <button className="mobile-back-btn" onClick={onBack}>{"< 退出"}</button>
          <h2 className="mobile-page-title">{title}</h2>
          <div />
        </div>
        <div className="mobile-quiz-finished">本轮已完成</div>
        <div className="mobile-quiz-finished-stats">对 {correctCount} 个，错 {wrongCount} 个</div>
        <div className="mobile-quiz-finished-stats">
          {operationLabel} {operationCount} 个
        </div>
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
          <div className="mobile-quiz-meaning">{renderMeaningPreview(current.parts)}</div>
        )}

        <div className="mobile-quiz-input-row">
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
            <button
              className="btn secondary mobile-replay-btn"
              onClick={() => playAudio(current.am_audio || current.en_audio)}
            >
              重播
            </button>
          )}
        </div>

        <div className="mobile-quiz-actions">
          <button className="btn secondary" onClick={submitOrNext}>
            {revealed ? "下一个" : "确认"}
          </button>
          <button className="btn secondary" onClick={handleOperation}>
            {operationLabel}
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        {revealed && (
          <div className="mobile-quiz-result-wrap">
            {result === "correct" && <div className="mobile-quiz-result ok">正确</div>}
            {result === "wrong" && <div className="mobile-quiz-result bad">错误</div>}
            <div className="mobile-quiz-word-detail">
              <div className="mobile-quiz-word-name">{current.word}</div>
              <MobileWordDetailBody row={current} playAudio={playAudio} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MobileReciteRoot({ units, notify, onRootHomeChange }) {
  const playAudio = useAudioPlayer();
  const [view, setView] = useState("home");
  const [context, setContext] = useState({ kind: "unit", unitId: 0, name: "" });
  const [words, setWords] = useState([]);
  const [selectedWord, setSelectedWord] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (onRootHomeChange) {
      onRootHomeChange(view === "home");
    }
  }, [view, onRootHomeChange]);

  function loadUnitWords(kind, unitId) {
    const path = kind === "forgotten"
      ? "/api/recite/forgotten/words"
      : `/api/recite/units/${unitId}/words`;
    setLoading(true);
    setError("");
    return api(path)
      .then((data) => setWords(data.words || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  function openUnit(unit) {
    setContext({ kind: "unit", unitId: unit.id, name: unit.name });
    setSelectedWord(null);
    setView("unit");
    loadUnitWords("unit", unit.id);
  }

  function openForgotten() {
    setContext({ kind: "forgotten", unitId: 0, name: "遗忘单词" });
    setSelectedWord(null);
    setView("unit");
    loadUnitWords("forgotten", 0);
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

  const opLabel = context.kind === "forgotten" ? "记住" : "忘记";
  const opAction = context.kind === "forgotten" ? rememberWord : forgetWord;

  if (view === "quiz_dictation") {
    const fetchPath = context.kind === "forgotten"
      ? "/api/recite/forgotten/dictation"
      : `/api/recite/units/${context.unitId}/dictation`;
    return (
      <MobileQuizPanel
        title={`${context.name} 听写`}
        type="dictation"
        fetchPath={fetchPath}
        operationLabel={opLabel}
        onOperation={opAction}
        onBack={() => {
          setView("unit");
          loadUnitWords(context.kind, context.unitId);
        }}
      />
    );
  }

  if (view === "quiz_spelling") {
    const fetchPath = context.kind === "forgotten"
      ? "/api/recite/forgotten/dictation"
      : `/api/recite/units/${context.unitId}/dictation`;
    return (
      <MobileQuizPanel
        title={`${context.name} 默写`}
        type="spelling"
        fetchPath={fetchPath}
        operationLabel={opLabel}
        onOperation={opAction}
        onBack={() => {
          setView("unit");
          loadUnitWords(context.kind, context.unitId);
        }}
      />
    );
  }

  if (view === "word" && selectedWord) {
    return (
      <div className="mobile-page-card">
        <div className="mobile-topbar">
          <button className="mobile-back-btn" onClick={() => setView("unit")}>{"< 退出"}</button>
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
            <button className="mobile-back-btn" onClick={() => setView("home")}>{"< 退出"}</button>
            <h2 className="mobile-page-title">{context.name}</h2>
            <div className="mobile-topbar-placeholder" />
          </div>

          {error && <div className="error">{error}</div>}
          <div className="mobile-unit-scroll">
            {loading && <div className="helper-tip">加载中...</div>}
            {!loading && words.length === 0 && <div className="helper-tip">暂无单词</div>}
            {words.map((row, idx) => {
              const meaningRows = formatMeaningLines(row.parts);
              return (
                <div key={`${row.word}-${idx}`} className="mobile-word-item">
                  <button
                    className="mobile-word-open-btn"
                    onClick={() => {
                      setSelectedWord(row);
                      setView("word");
                    }}
                  >
                    {row.word}
                  </button>
                  <div className="mobile-word-item-pron">
                    <a
                      className="mobile-pron-link"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        playAudio(row.en_audio);
                      }}
                    >
                      英 [{row.ph_en || "-"}]
                    </a>
                    <a
                      className="mobile-pron-link"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        playAudio(row.am_audio || row.en_audio);
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
          <button className="mobile-bottom-btn" onClick={() => setView("quiz_dictation")}>听写</button>
          <button className="mobile-bottom-btn" onClick={() => setView("quiz_spelling")}>默写</button>
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
  onCreateUnit,
  onRenameUnit,
  onReorderUnits,
  searchKeyword,
  onSearchKeywordChange,
  createName,
  onCreateNameChange,
}) {
  const [editingUnitId, setEditingUnitId] = useState(0);
  const [editingName, setEditingName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [draggingUnitId, setDraggingUnitId] = useState(0);
  const [dropUnitId, setDropUnitId] = useState(0);
  const [error, setError] = useState("");
  const canReorder = searchKeyword.trim() === "" && editingUnitId === 0;

  function startEdit(unit) {
    setError("");
    setEditingUnitId(unit.id);
    setEditingName(unit.name);
  }

  function saveEdit(unitId) {
    setError("");
    onRenameUnit(unitId, editingName)
      .then(() => {
        setEditingUnitId(0);
        setEditingName("");
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
            <div className="unit-item-row">
              <button
                className={`unit-item unit-main-btn ${selectedType === "unit" && selectedUnitId === unit.id ? "active" : ""}`}
                onClick={() => onSelectUnit(unit.id)}
              >
                {unit.name}
              </button>
              <button
                className="icon-btn"
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
                <button className="btn" onClick={() => saveEdit(unit.id)}>保存</button>
                <button className="btn secondary" onClick={() => setEditingUnitId(0)}>取消</button>
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
  const [globalError, setGlobalError] = useState("");
  const [toast, setToast] = useState({ visible: false, text: "", ts: 0 });
  const [showMobileRootNav, setShowMobileRootNav] = useState(true);

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
      body: { name: createName },
    })
      .then((data) => {
        const newUnit = data.unit;
        setCreateName("");
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

  function renameUnit(unitId, name) {
    setGlobalError("");
    const nextName = (name || "").trim();
    if (!nextName) {
      return Promise.reject(new Error("单元名称不能为空"));
    }
    return api(`/api/recite/units/${unitId}/name`, {
      method: "PUT",
      body: { name: nextName },
    }).then(() => {
      setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, name: nextName } : u)));
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
              onCreateUnit={createUnit}
              onRenameUnit={renameUnit}
              onReorderUnits={reorderUnits}
              searchKeyword={searchKeyword}
              onSearchKeywordChange={setSearchKeyword}
              createName={createName}
              onCreateNameChange={setCreateName}
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
            <ForgottenPanel notify={notify} />
          )}

          {mode === "recite" && selectedReciteType === "unit" && !selectedUnit && (
            <div className="right-panel-inner">
              <h2>请选择单元</h2>
              <p className="helper-tip">左侧可以添加单元、搜索单元并点击进入内容。</p>
            </div>
          )}

          {mode === "recite" && selectedReciteType === "unit" && selectedUnit && (
            <ReciteUnitPanel key={selectedUnit.id} unit={selectedUnit} notify={notify} />
          )}
        </main>
      </div>
      <div className={`toast-tip ${toast.visible ? "show" : ""}`}>{toast.text}</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
