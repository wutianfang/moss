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
  const sentences = currentGroup ? (currentGroup.sentences || []) : [];
  const visibleSentences = expanded ? sentences : sentences.slice(0, 3);
  const meanTag = (row.mean_tag || "").trim();

  useEffect(() => {
    setGroupIndex(0);
    setExpanded(false);
  }, [row.word, sentenceGroups.length]);

  return (
    <div className="explain-box">
      <div>
        <div className="small-title">标签</div>
        <div className="mean-tag-text">{meanTag || "-"}</div>
      </div>

      <div className="section-divider" />

      <div>
        <div className="small-title">释义</div>
        <ol className="part-list">
          {(row.parts || []).map((part, idx) => (
            <li key={`${part.part}-${idx}`}>
              <strong>{part.part}</strong> {part.means.join("; ")}
            </li>
          ))}
          {(row.parts || []).length === 0 && <li>-</li>}
        </ol>
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
          <ol className="sentence-list">
            {visibleSentences.map((sentence, idx) => (
              <li className="sentence-item" key={`${sentence.en}-${idx}`}>
                <span
                  className="sentence-en"
                  onClick={() => playAudio(sentence.ttsUrl)}
                >
                  {sentence.en}
                </span>
                {sentence.ttsUrl && (
                  <a
                    className="sound-link"
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      playAudio(sentence.ttsUrl);
                    }}
                  >
                    播放
                  </a>
                )}
                <div className="sentence-cn">{sentence.cn}</div>
                {sentence.from && <div className="sentence-from">{sentence.from}</div>}
              </li>
            ))}
          </ol>
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

function WordTable({ rows, playAudio }) {
  return (
    <table className="word-table">
      <thead>
        <tr>
          <th style={{ width: "56px" }}>序号</th>
          <th style={{ width: "160px" }}>单词</th>
          <th style={{ width: "260px" }}>音标</th>
          <th>单词说明</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={`${row.word}-${idx}`}>
            <td>{idx + 1}</td>
            <td>{row.word}</td>
            <td>
              <div className="yinbiao-row">
                英音：
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    playAudio(row.en_audio);
                  }}
                >
                  {row.ph_en || "-"}
                </a>
              </div>
              <div className="yinbiao-row">
                美音：
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    playAudio(row.am_audio || row.en_audio);
                  }}
                >
                  {row.ph_am || "-"}
                </a>
              </div>
            </td>
            <td>
              <PartAndSentence row={row} playAudio={playAudio} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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

function DictationPanel({ unitId, onBack }) {
  const playAudio = useAudioPlayer();
  const [words, setWords] = useState([]);
  const [index, setIndex] = useState(-1);
  const [showAnswer, setShowAnswer] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/api/recite/units/${unitId}/dictation`)
      .then((data) => {
        setWords(data.words || []);
        setIndex(-1);
        setShowAnswer(false);
      })
      .catch((err) => setError(err.message));
  }, [unitId]);

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

  return (
    <div className="right-panel-inner">
      <h2>听写单词</h2>
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
          <button className="btn secondary" onClick={onBack}>返回单元内容</button>
        </div>
        {error && <div className="error">{error}</div>}
      </div>
      {showAnswer && (
        <div style={{ marginTop: "14px" }}>
          <WordTable rows={words} playAudio={playAudio} />
        </div>
      )}
    </div>
  );
}

function ReciteUnitPanel({ unit }) {
  const playAudio = useAudioPlayer();
  const [view, setView] = useState("detail");
  const [wordInput, setWordInput] = useState("");
  const [queryWord, setQueryWord] = useState(null);
  const [wordRows, setWordRows] = useState([]);
  const [error, setError] = useState("");

  function loadWords() {
    api(`/api/recite/units/${unit.id}/words`)
      .then((data) => setWordRows(data.words || []))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    setView("detail");
    setQueryWord(null);
    setError("");
    loadWords();
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

  if (view === "dictation") {
    return <DictationPanel unitId={unit.id} onBack={() => setView("detail")} />;
  }

  return (
    <div className="right-panel-inner">
      <div className="panel-header-row">
        <h2>单元：{unit.name}</h2>
        <div className="unit-actions">
          <button className="btn brand" onClick={() => setView("dictation")}>听写单词</button>
        </div>
      </div>

      <section className="query-box">
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
          <div className="word-preview">
            <div className="small-title">发音</div>
            <div>
              <span>英音：</span>
              <a href="#" onClick={(e) => { e.preventDefault(); playAudio(queryWord.en_audio_url); }}>
                {queryWord.ph_en || "-"}
              </a>
              <span style={{ marginLeft: "12px" }}>美音：</span>
              <a href="#" onClick={(e) => { e.preventDefault(); playAudio(queryWord.am_audio_url || queryWord.en_audio_url); }}>
                {queryWord.ph_am || "-"}
              </a>
            </div>
            <PartAndSentence row={{ word: queryWord.word, mean_tag: queryWord.mean_tag, parts: queryWord.parts, sentence_groups: queryWord.sentence_groups }} playAudio={playAudio} />
            <button className="btn brand" onClick={addWordToUnit}>添加到单元</button>
          </div>
        )}
      </section>

      {error && <div className="error">{error}</div>}

      <section>
        <h3>单元单词</h3>
        <WordTable rows={wordRows} playAudio={playAudio} />
      </section>
    </div>
  );
}

function SidebarRecite({
  units,
  selectedUnitId,
  onSelectUnit,
  onCreateUnit,
  onRenameUnit,
  searchKeyword,
  onSearchKeywordChange,
  createName,
  onCreateNameChange,
}) {
  const [editingUnitId, setEditingUnitId] = useState(0);
  const [editingName, setEditingName] = useState("");
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

  return (
    <div className="sidebar-body">
      <div>
        <h3 className="side-title">背单词</h3>
        <div className="sidebar-block">
          <input
            className="input side-input"
            placeholder="搜索单元"
            value={searchKeyword}
            onChange={(e) => onSearchKeywordChange(e.target.value)}
          />
        </div>

        <div className="sidebar-block create-row">
          <input
            className="input side-input"
            placeholder="新单元名称"
            value={createName}
            onChange={(e) => onCreateNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onCreateUnit();
              }
            }}
          />
          <button className="btn" onClick={onCreateUnit}>添加</button>
        </div>
      </div>

      <ul className="unit-list side-unit-list">
        {units.map((unit) => (
          <li key={unit.id} className="unit-row-wrap">
            <div className="unit-item-row">
              <button
                className={`unit-item unit-main-btn ${selectedUnitId === unit.id ? "active" : ""}`}
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
  const [selectedUnitId, setSelectedUnitId] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [createName, setCreateName] = useState("");
  const [globalError, setGlobalError] = useState("");

  function loadUnits() {
    api("/api/recite/units")
      .then((data) => {
        const rows = data.units || [];
        setUnits(rows);
        if (rows.length > 0 && !rows.some((x) => x.id === selectedUnitId)) {
          setSelectedUnitId(rows[0].id);
        }
        if (rows.length === 0) {
          setSelectedUnitId(0);
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
    api("/api/recite/units", {
      method: "POST",
      body: { name: createName },
    })
      .then((data) => {
        const newUnit = data.unit;
        setCreateName("");
        loadUnits();
        if (newUnit && newUnit.id) {
          setSelectedUnitId(newUnit.id);
        }
      })
      .catch((err) => setGlobalError(err.message));
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
              selectedUnitId={selectedUnitId}
              onSelectUnit={setSelectedUnitId}
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

          {mode === "recite" && !selectedUnit && (
            <div className="right-panel-inner">
              <h2>请选择单元</h2>
              <p className="helper-tip">左侧可以添加单元、搜索单元并点击进入内容。</p>
            </div>
          )}

          {mode === "recite" && selectedUnit && (
            <ReciteUnitPanel unit={selectedUnit} />
          )}
        </main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
