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

function PartAndSentence({ row, playAudio }) {
  const [expanded, setExpanded] = useState(false);
  const [groupIndex, setGroupIndex] = useState(0);
  const sentenceGroups = row.sentence_groups || [];
  const currentGroup = sentenceGroups[groupIndex] || sentenceGroups[0] || null;
  const sentences = currentGroup ? currentGroup.sentences || [] : [];
  const visibleSentences = expanded ? sentences : sentences.slice(0, 3);

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
                  className={`group-tab ${idx === groupIndex ? "active" : ""}`}
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
              <li className="sentence-item" key={`${sentence.en}-${idx}`}>
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
        {sentences.length > 3 && (
          <button className="text-btn" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "收起例句" : "展开更多例句"}
          </button>
        )}
      </div>
    </div>
  );
}

function WordTable({ rows, playAudio, operationLabel, onOperation }) {
  const showOperation = Boolean(operationLabel && onOperation);
  return (
    <table className="word-table">
      <thead>
        <tr>
          <th style={{ width: "56px" }}>序号</th>
          <th style={{ width: "160px" }}>单词</th>
          <th>单词说明</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={`${row.word}-${idx}`}>
            <td>{idx + 1}</td>
            <td>{row.word}</td>
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
        ))}
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
  const [error, setError] = useState("");

  useEffect(() => {
    api(fetchPath)
      .then((data) => {
        setWords(data.words || []);
        setIndex(-1);
        setShowAnswer(false);
        setError("");
      })
      .catch((err) => setError(err.message));
  }, [fetchPath]);

  function readNext() {
    if (index + 1 >= words.length) {
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

  function handleOperation(word) {
    if (!onOperation) {
      return;
    }
    onOperation(word)
      .then(() => {
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
        <div className="dictation-actions">
          <button className="btn brand" onClick={readNext}>读下一单词</button>
          <button className="btn" onClick={repeatCurrent}>重复当前单词</button>
          <button className="btn secondary" onClick={() => setShowAnswer((v) => !v)}>
            {showAnswer ? "隐藏答案" : "显示答案"}
          </button>
          <button className="btn secondary" onClick={onBack}>返回列表</button>
        </div>
        {error && <div className="error">{error}</div>}
      </div>
      {showAnswer && (
        <div style={{ marginTop: "14px" }}>
          <WordTable
            rows={words}
            playAudio={playAudio}
            operationLabel={operationLabel}
            onOperation={handleOperation}
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
  const [error, setError] = useState("");

  useEffect(() => {
    api(fetchPath)
      .then((data) => {
        setWords(data.words || []);
        setShowAnswer(false);
        setError("");
      })
      .catch((err) => setError(err.message));
  }, [fetchPath]);

  function handleOperation(word) {
    if (!onOperation) {
      return;
    }
    onOperation(word)
      .then(() => {
        if (removeOnOperationSuccess) {
          setWords((prev) => prev.filter((item) => item.word !== word));
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

      <table className="word-table" style={{ marginTop: "14px" }}>
        <thead>
          <tr>
            <th style={{ width: "64px" }}>编号</th>
            <th>释义</th>
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
  const [error, setError] = useState("");

  function loadWords() {
    return api(`/api/recite/units/${unit.id}/words`)
      .then((data) => setWordRows(data.words || []));
  }

  useEffect(() => {
    setView("detail");
    setQueryWord(null);
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

function SidebarRecite({
  units,
  selectedType,
  selectedUnitId,
  onSelectUnit,
  onSelectForgotten,
  onCreateUnit,
  onRenameUnit,
  searchKeyword,
  onSearchKeywordChange,
  createName,
  onCreateNameChange,
}) {
  const [editingUnitId, setEditingUnitId] = useState(0);
  const [editingName, setEditingName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");

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
          <li key={unit.id} className="unit-row-wrap">
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
  const [mode, setMode] = useState("recite");
  const [units, setUnits] = useState([]);
  const [selectedReciteType, setSelectedReciteType] = useState("unit");
  const [selectedUnitId, setSelectedUnitId] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [createName, setCreateName] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [toast, setToast] = useState({ visible: false, text: "", ts: 0 });

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
            <ReciteUnitPanel unit={selectedUnit} notify={notify} />
          )}
        </main>
      </div>
      <div className={`toast-tip ${toast.visible ? "show" : ""}`}>{toast.text}</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
