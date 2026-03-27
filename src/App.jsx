import { useState, useEffect, useRef, useCallback } from 'react';
import mammoth from 'mammoth';
import { COURSE_NOTES, COURSE_FACULTY } from './courseData.js';
import { PRIORITY_NOTES } from './priorityData.js';

const STORAGE_KEY = "ipa_lgov_quiz_v3";
// ── PRELOAD MANIFEST ──────────────────────────────────────────────────────
const PRELOAD_NOTES_FILES = [
  "/notes/Lesson 1 - IPA Certificate in Local Government Studies - Rationale, Purpose, Governance.pdf",
  "/notes/Lesson 2 - IPA Certificate in Local Government Studies - Reform.pdf",
  "/notes/Lesson 3 - IPA Certificate in Local Government Studies - Finance.pdf",
  "/notes/Lesson 4 - IPA Certificate in Local Government Studies - Human Resources.pdf",
  "/notes/Lesson 5 - IPA Certificate in Local Government Studies - Role of CE, Cllrs, and Procedures at Meetings.pdf",
  "/notes/Lesson 6 - IPA Certificate in Local Government Studies - Planning 2025.pdf",
  "/notes/Lesson 7 - IPA Certificate in Local Government Studies - Housing.pdf",
  "/notes/Lesson 8 - IPA Certificate in Local Government Studies - Climate Change.pdf",
  "/notes/Lesson 9 - IPA Certificate in Local Government Studies - Environmental Protection.pdf",
  "/notes/Social Housing Household Income Limits.pdf",
  "/notes/Lesson 10 - IPA Certificate in Local Government Studies - Roads.pdf",
  "/notes/Lesson 11 - IPA Certificate in Local Government Studies - Library, Arts  Social Welfare.pdf",
  "/notes/Lesson 12 - IPA Certificate in Local Government Studies - Economic and Local Development and Local Elections.pdf",
  "/notes/CLG - Exam Preparation Presentation 2026.pdf",
];
const PRELOAD_FACULTY_FILE = "/faculty/Certificate in Local Government Studies - Sample MCQs (Moodle) 2.docx";
const DEFAULT_TOPICS = [
  { id: "t1",  name: "Rationale, Purpose and Governance" },
  { id: "t2",  name: "Local Government Reform" },
  { id: "t3",  name: "Local Government Finance" },
  { id: "t4",  name: "Human Resources" },
  { id: "t5",  name: "Role of CE, Councillors and Meeting Procedures" },
  { id: "t6",  name: "Planning" },
  { id: "t7",  name: "Housing" },
  { id: "t8",  name: "Climate Change" },
  { id: "t9",  name: "Environmental Protection" },
  { id: "t10", name: "Roads" },
  { id: "t11", name: "Library, Arts and Social Welfare" },
  { id: "t12", name: "Economic and Local Development and Local Elections" },
];
async function preloadCourseFiles(apiKey, onProgress) {
  const total = PRELOAD_NOTES_FILES.length + 1;
  let done = 0;
  const texts = [];
  for (const path of PRELOAD_NOTES_FILES) {
    const name = path.split("/").pop();
    onProgress(`Reading ${name.slice(0, 50)}… (${done + 1}/${total})`);
    const res = await fetch(path);
    const blob = await res.blob();
    const file = new File([blob], name, { type: "application/pdf" });
    const text = await readFileAsText(file, apiKey);
    texts.push(`=== ${name} ===\n\n${text}`);
    done++;
  }
  onProgress(`Reading Sample MCQs… (${total}/${total})`);
  const facultyRes = await fetch(PRELOAD_FACULTY_FILE);
  const facultyBlob = await facultyRes.blob();
  const facultyFile = new File([facultyBlob], "Sample MCQs.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const facultyText = await readFileAsText(facultyFile, apiKey);
  return { notes: texts.join("\n\n---\n\n"), faculty: facultyText };
}
// ── FACULTY QUESTIONS ─────────────────────────────────────────────────────
const FACULTY_QUESTIONS = [
  {
    id: "fq1", topic: "Local Government Structure",
    question: "Which of the following best describes the role of the Chief Executive in Irish local government?",
    options: ["To chair all council meetings and vote on resolutions", "To manage day-to-day operations and implement council decisions", "To represent the council in Oireachtas negotiations", "To appoint and dismiss elected councillors"],
    correct: 1,
    explanation: "The Chief Executive (formerly County/City Manager) manages day-to-day administration and implements decisions made by the elected council. They do not chair meetings or vote — that is the role of the Cathaoirleach.",
    isFaculty: true
  },
  {
    id: "fq2", topic: "Local Government Finance",
    question: "What is the primary source of locally raised income for Irish local authorities?",
    options: ["Income tax receipts allocated by central government", "Commercial rates levied on business properties", "Residential property charges collected directly", "EU structural and cohesion funds"],
    correct: 1,
    explanation: "Commercial rates — levied on occupiers of commercial and industrial properties — are the main source of locally raised income for Irish local authorities.",
    isFaculty: true
  },
  {
    id: "fq3", topic: "Local Government Reform",
    question: "The Local Government Reform Act 2014 resulted in which significant change?",
    options: ["Creation of eight regional assemblies with legislative powers", "Abolition of town councils and merger of some city/county councils", "Introduction of directly elected mayors in all cities", "Transfer of planning functions to An Bord Pleanála"],
    correct: 1,
    explanation: "The 2014 Act abolished all 80 town councils and merged certain county/city councils — most notably creating unified councils for Dublin and merging Limerick City and County into a single authority.",
    isFaculty: true
  }
];
// ── HELPERS ───────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).substr(2, 9); }
function loadSaved() { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function persist(obj) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch {} }
// ── FILE READING ──────────────────────────────────────────────────────────
async function readFileAsText(file, apiKey) {
  if (file.name.endsWith(".docx")) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }
  if (file.type === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result);
      reader.onerror = rej;
      reader.readAsText(file);
    });
  }
  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    const base64 = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result.split(",")[1]);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", max_tokens: 4000,
        messages: [{ role: "user", content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          { type: "text", text: "Extract ALL text from this document. Return the full text content only, preserving headings and structure. Do not summarise — return everything verbatim." }
        ]}]
      })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.content?.find(b => b.type === "text")?.text || "";
  }
  throw new Error(`Unsupported file type: ${file.name}`);
}
// ── NOTE SELECTION ────────────────────────────────────────────────────────
// Parse combined notes into named sections
function parseSections(notes) {
  return notes.split(/\n\n---\n\n/).map(block => {
    const m = block.match(/^=== (.+?) ===/);
    return { header: m ? m[1] : "", text: block };
  });
}
// For a topic quiz: return only the section(s) that match the topic name
// For a mock exam (no topic): return a proportional sample capped at ~400k chars
function getNotesForContext(notes, topicName) {
  const MAX = 400000; // ~100k tokens, well within the 200k limit
  if (!topicName) {
    // Mock exam: sample evenly from all sections
    const sections = parseSections(notes);
    const perSection = Math.floor(MAX / sections.length);
    return sections.map(s => s.text.slice(0, perSection)).join("\n\n---\n\n");
  }
  // Topic quiz: find matching section by keyword overlap
  const sections = parseSections(notes);
  const keywords = topicName.toLowerCase().split(/[\s,&]+/).filter(w => w.length > 3);
  const scored = sections.map(s => {
    const h = s.header.toLowerCase();
    const score = keywords.filter(k => h.includes(k)).length;
    return { ...s, score };
  }).sort((a, b) => b.score - a.score);
  // Return the best matching section(s)
  const best = scored[0];
  if (best.score > 0) return best.text.slice(0, MAX);
  // No match — return all notes truncated
  return notes.slice(0, MAX);
}
// ── API CALLS ─────────────────────────────────────────────────────────────
const EXAMINER_SYSTEM = `You are a senior examiner for the IPA Certificate in Local Government Studies in Ireland.
Generate high-quality MCQ exam questions based on the course notes provided.
RULES:
- Questions must be HARDER than standard exam level — the student wants to be over-prepared
- Base ALL questions strictly on the provided notes and course content
- ALL 4 answer options must be plausible — no obviously wrong distractors
- Only ONE correct answer per question
- Test genuine understanding, not just rote memorisation
- Use Irish local government context throughout
- Pay special attention to HIGHLIGHTED, CAPITALISED, or emphasised content — high-priority topics
- Vary question types: definitions, applications, scenario-based, comparisons
- Return ONLY a valid JSON array, no markdown fences, no preamble`;
async function callClaude(apiKey, systemPrompt, userPrompt, maxTokens = 5000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const text = data.content?.find(b => b.type === "text")?.text || "[]";
  return text.replace(/```json|```/g, "").trim();
}
async function generateQuestions(apiKey, notes, topics, count, existingQs = [], facultyStyle = "", courseOutline = "", singleTopic = null, priorityNotes = "") {
  const topicList = topics.map(t => t.name).join(", ");
  const avoidList = existingQs.slice(0, 8).map(q => `- ${q.question}`).join("\n");
  const contextNotes = getNotesForContext(notes, singleTopic);
  const prioritySection = priorityNotes.trim()
    ? `PRIORITY STUDY NOTES — generate at least 70% of questions directly from this content (these are the student's own key points):\n${priorityNotes.slice(0, 150000)}\n\nSUPPLEMENTARY COURSE NOTES (use to fill any gaps):\n${contextNotes}`
    : `COURSE NOTES:\n${contextNotes}`;
  const prompt = `Generate exactly ${count} MCQ questions for the IPA Certificate in Local Government Studies exam.
TOPICS TO COVER (spread proportionally): ${topicList}
${prioritySection}
${courseOutline ? `COURSE OUTLINE:\n${courseOutline}` : ""}
${facultyStyle ? `FACULTY SAMPLE QUESTIONS (match or exceed this difficulty — real exam is harder):\n${facultyStyle}` : ""}
${avoidList ? `DO NOT repeat:\n${avoidList}` : ""}
Return a JSON array. Each object: { "topic": "...", "question": "...", "options": ["A","B","C","D"], "correct": 0, "explanation": "..." }`;
  const raw = await callClaude(apiKey, EXAMINER_SYSTEM, prompt, 5000);
  return JSON.parse(raw).map(q => ({ ...q, id: uid(), isFaculty: false }));
}
async function generateWeakQuestions(apiKey, notes, wrongQs, allTopics, priorityNotes = "") {
  const weakTopics = [...new Set(wrongQs.map(q => q.topic))];
  const topicStr = weakTopics.length ? weakTopics.join(", ") : allTopics.map(t => t.name).join(", ");
  const wrongSample = wrongQs.slice(0, 10).map(q => `Q: ${q.question}\nCorrect: ${q.options[q.correct]}`).join("\n\n");
  const contextNotes = getNotesForContext(notes, weakTopics[0] || null);
  const prioritySection = priorityNotes.trim()
    ? `PRIORITY STUDY NOTES:\n${priorityNotes.slice(0, 150000)}\n\nSUPPLEMENTARY COURSE NOTES:\n${contextNotes}`
    : `COURSE NOTES: ${contextNotes}`;
  const prompt = `Generate 15 MCQ questions on these WEAK AREAS: ${topicStr}
Student struggled with these — generate fresh questions on the same concepts:
${wrongSample}
~50% fresh variations, ~50% new questions on weak topics.
${prioritySection}
Return a JSON array: { "topic":"...","question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..." }`;
  const raw = await callClaude(apiKey, EXAMINER_SYSTEM, prompt, 3500);
  return JSON.parse(raw).map(q => ({ ...q, id: uid(), isFaculty: false }));
}
// ── COLOURS ───────────────────────────────────────────────────────────────
const C = { navy:"#1a365d", blue:"#2563eb", green:"#059669", amber:"#d97706", red:"#dc2626", purple:"#7c3aed", slate:"#475569" };
// ── SMALL COMPONENTS ──────────────────────────────────────────────────────
function Bar({ pct, color = C.blue }) {
  return <div style={{ background:"#e5e7eb", borderRadius:99, height:7, overflow:"hidden" }}>
    <div style={{ height:"100%", width:`${Math.min(100,pct)}%`, background:color, borderRadius:99, transition:"width .5s ease" }} />
  </div>;
}
function Chip({ label, color = C.blue, bg = "#dbeafe" }) {
  return <span style={{ display:"inline-block", padding:"2px 10px", borderRadius:99, background:bg, color, fontSize:12, fontWeight:700 }}>{label}</span>;
}
function topicColor(topic) {
  const p = [[C.navy,"#dbeafe"],[C.green,"#d1fae5"],[C.purple,"#ede9fe"],["#92400e","#fef3c7"],[C.red,"#fee2e2"],["#0e7490","#cffafe"]];
  return p[(topic?.charCodeAt(0)||0) % p.length];
}
function TopicBadge({ topic }) {
  const [color,bg] = topicColor(topic);
  return <Chip label={topic||"General"} color={color} bg={bg} />;
}
// ── FILE UPLOAD ZONE ──────────────────────────────────────────────────────
function FileUploadZone({ onTextExtracted, existingText, placeholder, apiKey }) {
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [error, setError] = useState(null);
  const [text, setText] = useState(existingText || "");
  const [mode, setMode] = useState(existingText ? "paste" : "upload");
  const inputRef = useRef(null);
  const handleFiles = async (files) => {
    setError(null); setUploading(true);
    try {
      const results = [];
      for (const file of Array.from(files)) {
        const extracted = await readFileAsText(file, apiKey);
        results.push({ name: file.name, text: extracted });
      }
      const combined = results.map(r => `=== ${r.name} ===\n\n${r.text}`).join("\n\n---\n\n");
      const newText = text ? text + "\n\n" + combined : combined;
      setText(newText);
      setUploadedFiles(prev => [...prev, ...results.map(r => r.name)]);
      onTextExtracted(newText);
    } catch(e) { setError("Could not read file: " + e.message); }
    setUploading(false);
  };
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {["upload","paste"].map(m => (
          <button key={m} onClick={() => setMode(m)} style={{ padding:"7px 16px", border:"2px solid", borderColor:mode===m?C.blue:"#e2e8f0", background:mode===m?"#eff6ff":"#fff", borderRadius:99, cursor:"pointer", fontSize:13, color:mode===m?"#1e40af":C.slate, fontWeight:mode===m?700:500 }}>
            {m === "upload" ? "📎 Upload File" : "✏️ Paste Text"}
          </button>
        ))}
      </div>
      {mode === "upload" && (
        <div>
          <div
            onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            style={{ border:"2px dashed #cbd5e1", borderRadius:14, padding:"32px 20px", textAlign:"center", cursor:"pointer", background:uploading?"#f0f9ff":"#fafafa", transition:"all .2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor=C.blue; e.currentTarget.style.background="#f0f9ff"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor="#cbd5e1"; e.currentTarget.style.background=uploading?"#f0f9ff":"#fafafa"; }}
          >
            <input ref={inputRef} type="file" multiple accept=".pdf,.docx,.txt,.md" style={{ display:"none" }} onChange={e => handleFiles(e.target.files)} />
            {uploading ? (
              <>
                <div style={{ fontSize:32, marginBottom:8 }}>⏳</div>
                <div style={{ fontWeight:600, color:C.blue }}>Reading file…</div>
                <div style={{ fontSize:13, color:C.slate, marginTop:4 }}>PDF extraction may take a moment</div>
              </>
            ) : (
              <>
                <div style={{ fontSize:36, marginBottom:8 }}>📎</div>
                <div style={{ fontWeight:700, color:C.navy, fontSize:15 }}>Drop files here or click to browse</div>
                <div style={{ fontSize:13, color:C.slate, marginTop:6 }}>Supports <strong>.pdf</strong>, <strong>.docx</strong>, <strong>.txt</strong> · Multiple files OK</div>
              </>
            )}
          </div>
          {error && <div style={{ background:"#fee2e2", color:C.red, borderRadius:10, padding:"10px 14px", fontSize:13, marginTop:10 }}>⚠️ {error}</div>}
          {uploadedFiles.length > 0 && (
            <div style={{ marginTop:10 }}>
              {uploadedFiles.map((f,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 12px", background:"#f0fdf4", borderRadius:8, marginBottom:6, fontSize:13 }}>
                  <span style={{ color:C.green }}>✓</span>
                  <span style={{ color:"#1e293b", fontWeight:500 }}>{f}</span>
                  <span style={{ color:"#94a3b8", marginLeft:"auto" }}>extracted</span>
                </div>
              ))}
            </div>
          )}
          {text && (
            <div style={{ background:"#f8fafc", borderRadius:10, padding:"12px 14px", border:"1px solid #e2e8f0", marginTop:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <span style={{ fontSize:13, fontWeight:600, color:C.navy }}>Extracted content</span>
                <span style={{ fontSize:12, color:"#94a3b8" }}>{wordCount} words</span>
              </div>
              <p style={{ fontSize:12, color:C.slate, lineHeight:1.5, maxHeight:80, overflow:"hidden" }}>{text.slice(0,300)}{text.length>300?"...":""}</p>
              <button onClick={() => { setText(""); setUploadedFiles([]); onTextExtracted(""); }} style={{ marginTop:8, background:"none", border:"none", color:C.red, fontSize:12, cursor:"pointer", fontWeight:600 }}>× Clear</button>
            </div>
          )}
        </div>
      )}
      {mode === "paste" && (
        <div>
          <textarea value={text} onChange={e => { setText(e.target.value); onTextExtracted(e.target.value); }} placeholder={placeholder}
            style={{ width:"100%", minHeight:240, padding:16, border:"2px solid #e2e8f0", borderRadius:12, fontSize:14, lineHeight:1.7, resize:"vertical", fontFamily:"inherit", outline:"none", color:"#1e293b", background:"#fafafa" }}
            onFocus={e => e.target.style.borderColor=C.blue} onBlur={e => e.target.style.borderColor="#e2e8f0"} />
          <p style={{ fontSize:12, color:"#94a3b8", marginTop:6 }}>{wordCount} words</p>
        </div>
      )}
    </div>
  );
}
// ── SETUP ─────────────────────────────────────────────────────────────────
function Setup({ existing, onSave, apiKey }) {
  const [tab, setTab] = useState("notes");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [topics, setTopics] = useState(existing?.topics?.length ? existing.topics : Array.from({length:4},()=>({id:uid(),name:""})));
  const [faculty, setFaculty] = useState(existing?.faculty || "");
  const [outline, setOutline] = useState(existing?.outline || "");
  const [priorityNotes, setPriorityNotes] = useState(existing?.priorityNotes || "");
  const validTopics = topics.filter(t => t.name.trim());
  const canSave = notes.trim().length > 100 && validTopics.length > 0;
  const TABS = [{ id:"notes",label:"📄 Notes" },{ id:"topics",label:"📚 Topics" },{ id:"priority",label:"⭐ My Notes" },{ id:"faculty",label:"🎓 Sample Qs" },{ id:"outline",label:"📋 Outline" }];
  return (
    <div style={{ maxWidth:700, margin:"0 auto", padding:"32px 16px" }} className="fadein">
      <div style={{ textAlign:"center", marginBottom:32 }}>
        <div style={{ fontSize:52, marginBottom:8 }}>🏛️</div>
        <h1 style={{ fontSize:26, fontWeight:900, color:C.navy }}>IPA Local Government Studies</h1>
        <p style={{ color:C.slate, marginTop:8 }}>Upload your notes or paste text — then add your topics</p>
      </div>
      <div style={{ display:"flex", gap:4, background:"#f1f5f9", borderRadius:12, padding:4, marginBottom:20 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex:1, padding:"9px 6px", border:"none", borderRadius:8, cursor:"pointer", background:tab===t.id?"#fff":"transparent", color:tab===t.id?C.navy:C.slate, fontWeight:tab===t.id?700:500, fontSize:13, boxShadow:tab===t.id?"0 1px 4px rgba(0,0,0,.08)":"none", transition:"all .2s" }}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "notes" && (
        <div className="fadein">
          <p style={{ color:C.slate, fontSize:14, marginBottom:12 }}>Upload your course notes as a <strong>.pdf</strong> or <strong>.docx</strong>, or paste text. <strong>CAPITALISED or emphasised text is treated as high-priority exam content.</strong></p>
          <FileUploadZone existingText={notes} onTextExtracted={setNotes} apiKey={apiKey} placeholder={"Paste your full course notes here...\n\nInclude definitions, legislation, structures, functions, key dates, reforms — everything.\n\nMark IMPORTANT sections in CAPS or with ** to prioritise them."} />
        </div>
      )}
      {tab === "topics" && (
        <div className="fadein">
          <p style={{ color:C.slate, fontSize:14, marginBottom:14 }}>Add your 12–13 course topics. These power the topic quiz mode and ensure mock exam questions are spread proportionally.</p>
          {topics.map((t,i) => (
            <div key={t.id} style={{ display:"flex", gap:8, marginBottom:9, alignItems:"center" }}>
              <span style={{ color:"#94a3b8", fontSize:14, width:24, textAlign:"right", flexShrink:0 }}>{i+1}.</span>
              <input value={t.name} onChange={e => setTopics(ts => ts.map(tp => tp.id===t.id?{...tp,name:e.target.value}:tp))} placeholder="e.g. Local Government Finance"
                style={{ flex:1, padding:"10px 14px", border:"2px solid #e2e8f0", borderRadius:10, fontSize:14, fontFamily:"inherit", outline:"none", color:"#1e293b" }}
                onFocus={e => e.target.style.borderColor=C.blue} onBlur={e => e.target.style.borderColor="#e2e8f0"} />
              {topics.length > 1 && <button onClick={() => setTopics(ts => ts.filter(tp=>tp.id!==t.id))} style={{ width:34, height:34, border:"none", background:"#fee2e2", color:C.red, borderRadius:8, cursor:"pointer", fontSize:18, flexShrink:0 }}>×</button>}
            </div>
          ))}
          <button onClick={() => setTopics(ts=>[...ts,{id:uid(),name:""}])} style={{ width:"100%", marginTop:6, padding:"10px", border:"2px dashed #cbd5e1", background:"transparent", borderRadius:10, cursor:"pointer", color:C.slate, fontSize:14, fontWeight:600 }}>+ Add Topic</button>
        </div>
      )}
      {tab === "priority" && (
        <div className="fadein">
          <p style={{ color:C.slate, fontSize:14, marginBottom:12 }}>Upload your condensed notes and NotebookLM slides here. <strong>The quiz will generate at least 70% of questions from this content</strong> — these are treated as high priority over the full lesson notes.</p>
          <div style={{ background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:13, color:"#92400e" }}>
            ⭐ Multiple files OK — upload your key points PDF + all NotebookLM slide decks at once
          </div>
          <FileUploadZone existingText={priorityNotes} onTextExtracted={setPriorityNotes} apiKey={apiKey} placeholder={"Upload your condensed notes and NotebookLM slides here...\n\nThese are prioritised over the full lesson notes when generating quiz questions."} />
        </div>
      )}
      {tab === "faculty" && (
        <div className="fadein">
          <p style={{ color:C.slate, fontSize:14, marginBottom:12 }}>Upload or paste faculty sample questions. Included as real exam questions <strong>and</strong> used to calibrate difficulty — the app generates at this level or harder.</p>
          <FileUploadZone existingText={faculty} onTextExtracted={setFaculty} apiKey={apiKey} placeholder={"Paste faculty sample questions here in any format..."} />
        </div>
      )}
      {tab === "outline" && (
        <div className="fadein">
          <p style={{ color:C.slate, fontSize:14, marginBottom:12 }}>Upload or paste your course outline. Helps the AI understand topic weightings and what's most examinable.</p>
          <FileUploadZone existingText={outline} onTextExtracted={setOutline} apiKey={apiKey} placeholder={"Paste your course outline / syllabus here..."} />
        </div>
      )}
      <button onClick={() => onSave({notes, topics:validTopics, faculty, outline, priorityNotes})} disabled={!canSave}
        style={{ width:"100%", marginTop:24, padding:16, border:"none", borderRadius:14, fontSize:16, fontWeight:700, cursor:canSave?"pointer":"not-allowed", background:canSave?C.navy:"#e2e8f0", color:canSave?"#fff":"#94a3b8", transition:"all .2s" }}>
        {canSave ? "Save & Go to Dashboard →" : "Add notes and at least one topic to continue"}
      </button>
    </div>
  );
}
// ── DASHBOARD ─────────────────────────────────────────────────────────────
function Dashboard({ setup, stats, onMock, onTopic, onWeak, onWrongOnly, onEditSetup, error }) {
  const wrongCount = stats.wrongQuestions?.length || 0;
  const totalQ = stats.totalAttempted || 0;
  const totalC = stats.totalCorrect || 0;
  const avg = totalQ > 0 ? Math.round((totalC/totalQ)*100) : null;
  const topicPerf = stats.topicStats ? Object.entries(stats.topicStats).filter(([,s])=>s.total>0) : [];
  const weakTopics = [...topicPerf].sort((a,b)=>(a[1].correct/a[1].total)-(b[1].correct/b[1].total)).slice(0,3).map(([t])=>t);
  return (
    <div style={{ maxWidth:680, margin:"0 auto", padding:"24px 16px 60px" }} className="fadein">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:900, color:C.navy }}>🏛️ IPA Quiz</h1>
          <p style={{ color:C.slate, fontSize:13, marginTop:2 }}>Local Government Studies · Certificate Exam Prep</p>
        </div>
        <button onClick={onEditSetup} style={{ padding:"8px 14px", border:"2px solid #e2e8f0", background:"#fff", borderRadius:10, cursor:"pointer", fontSize:13, color:C.slate, fontWeight:600 }}>⚙️ Notes</button>
      </div>
      {error && <div style={{ background:"#fee2e2", color:C.red, borderRadius:12, padding:"12px 16px", marginBottom:20, fontSize:14 }}>⚠️ {error}</div>}
      {avg !== null && (
        <div style={{ background:`linear-gradient(135deg,${C.navy},${C.blue})`, borderRadius:18, padding:"22px 24px", color:"#fff", marginBottom:22, display:"flex", gap:20, alignItems:"center" }}>
          <div style={{ textAlign:"center", flexShrink:0 }}>
            <div style={{ fontSize:44, fontWeight:900, lineHeight:1 }}>{avg}%</div>
            <div style={{ fontSize:12, opacity:.8, marginTop:4 }}>Overall</div>
          </div>
          <div style={{ flex:1, borderLeft:"1px solid rgba(255,255,255,.2)", paddingLeft:20 }}>
            <div style={{ fontSize:14, opacity:.9, marginBottom:6 }}>{totalC} correct from {totalQ} questions</div>
            <Bar pct={(totalC/totalQ)*100} color="#93c5fd" />
            {weakTopics.length>0 && <div style={{ fontSize:12, opacity:.7, marginTop:8 }}>Weakest: {weakTopics.join(" · ")}</div>}
          </div>
        </div>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <button onClick={onMock} style={{ padding:"20px", border:`2px solid ${C.navy}`, background:"#fff", borderRadius:16, cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:16, transition:"all .15s" }}
          onMouseEnter={e=>e.currentTarget.style.background="#eff6ff"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
          <span style={{ fontSize:36 }}>📝</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, color:"#1e293b", fontSize:16 }}>Mock Exam</div>
            <div style={{ color:C.slate, fontSize:13, marginTop:2 }}>40 questions · timed or untimed · full simulation · go back & change answers</div>
          </div>
          <Chip label="40 Qs" color={C.navy} bg="#dbeafe" />
        </button>
        <div style={{ background:"#fff", borderRadius:16, border:"2px solid #e2e8f0" }}>
          <div style={{ padding:"18px 20px 14px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
              <span style={{ fontSize:32 }}>📚</span>
              <div>
                <div style={{ fontWeight:700, color:"#1e293b", fontSize:16 }}>Topic Quiz</div>
                <div style={{ color:C.slate, fontSize:13 }}>10 questions per topic · feedback at end</div>
              </div>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {setup.topics.map(t => (
                <button key={t.id} onClick={() => onTopic(t)} style={{ padding:"8px 14px", border:"2px solid #e2e8f0", background:"#f8fafc", borderRadius:10, cursor:"pointer", fontSize:13, color:C.navy, fontWeight:600, transition:"all .15s" }}
                  onMouseEnter={e=>{e.target.style.borderColor=C.blue;e.target.style.background="#eff6ff";}} onMouseLeave={e=>{e.target.style.borderColor="#e2e8f0";e.target.style.background="#f8fafc";}}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button onClick={wrongCount>0?onWeak:undefined} style={{ padding:"20px", border:`2px solid ${wrongCount>0?C.purple:"#e2e8f0"}`, background:"#fff", borderRadius:16, cursor:wrongCount>0?"pointer":"not-allowed", textAlign:"left", display:"flex", alignItems:"center", gap:16, opacity:wrongCount>0?1:0.55, transition:"all .15s" }}
          onMouseEnter={e=>{if(wrongCount>0)e.currentTarget.style.background="#f5f3ff";}} onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
          <span style={{ fontSize:36 }}>🎯</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, color:"#1e293b", fontSize:16 }}>Weak Areas</div>
            <div style={{ color:C.slate, fontSize:13, marginTop:2 }}>{wrongCount>0?`AI generates fresh questions on your weak topics`:"Complete a quiz first to build your weak areas bank"}</div>
          </div>
          <Chip label={wrongCount>0?`${wrongCount} saved`:"No data"} color={wrongCount>0?C.purple:"#94a3b8"} bg={wrongCount>0?"#ede9fe":"#f1f5f9"} />
        </button>
        <button onClick={wrongCount>0?onWrongOnly:undefined} style={{ padding:"20px", border:`2px solid ${wrongCount>0?"#dc2626":"#e2e8f0"}`, background:"#fff", borderRadius:16, cursor:wrongCount>0?"pointer":"not-allowed", textAlign:"left", display:"flex", alignItems:"center", gap:16, opacity:wrongCount>0?1:0.55, transition:"all .15s" }}
          onMouseEnter={e=>{if(wrongCount>0)e.currentTarget.style.background="#fff5f5";}} onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
          <span style={{ fontSize:36 }}>❌</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, color:"#1e293b", fontSize:16 }}>Wrong Answers Only</div>
            <div style={{ color:C.slate, fontSize:13, marginTop:2 }}>{wrongCount>0?`Replay exactly the ${wrongCount} questions you got wrong · no AI mixing · instant start`:"Complete a quiz first to build your wrong answers bank"}</div>
          </div>
          <Chip label={wrongCount>0?`${wrongCount} Qs`:"No data"} color={wrongCount>0?C.red:"#94a3b8"} bg={wrongCount>0?"#fee2e2":"#f1f5f9"} />
        </button>
      </div>
      {topicPerf.length > 0 && (
        <div style={{ marginTop:28 }}>
          <h3 style={{ fontSize:15, fontWeight:700, color:C.navy, marginBottom:14 }}>📊 Topic Performance</h3>
          {[...topicPerf].sort((a,b)=>(a[1].correct/a[1].total)-(b[1].correct/b[1].total)).map(([topic,s]) => {
            const p = Math.round((s.correct/s.total)*100);
            const col = p>=75?C.green:p>=50?C.amber:C.red;
            return <div key={topic} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:13, color:"#374151" }}>{topic}</span>
                <span style={{ fontSize:13, fontWeight:700, color:col }}>{p}% ({s.correct}/{s.total})</span>
              </div>
              <Bar pct={p} color={col} />
            </div>;
          })}
        </div>
      )}
    </div>
  );
}
// ── EXAM CONFIG ───────────────────────────────────────────────────────────
function ExamConfig({ mode, topicName, onStart, onBack, wrongCount = 0 }) {
  const [timed, setTimed] = useState(true);
  const defaultCount = mode === "mock" ? 40 : 10;
  const [count, setCount] = useState(defaultCount);
  const isMock = mode === "mock";
  const isWrong = mode === "wrong";
  const icon = isMock ? "📝" : isWrong ? "❌" : "📚";
  const title = isMock ? "Mock Exam" : isWrong ? "Wrong Answers Only" : topicName;
  const maxWrong = isWrong ? wrongCount : Infinity;
  const countOptions = [10, 15, 20, 40].filter(n => !isWrong || n <= maxWrong);
  return (
    <div style={{ maxWidth:480, margin:"60px auto", padding:"24px 16px" }} className="fadein">
      <button onClick={onBack} style={{ background:"none", border:"none", color:C.slate, cursor:"pointer", fontSize:14, marginBottom:24, display:"flex", alignItems:"center", gap:6 }}>← Back</button>
      <div style={{ textAlign:"center", marginBottom:32 }}>
        <div style={{ fontSize:48, marginBottom:10 }}>{icon}</div>
        <h2 style={{ fontSize:22, fontWeight:800, color:C.navy }}>{title}</h2>
        <p style={{ color:C.slate, marginTop:8, fontSize:14 }}>
          {isMock ? "Proportional across all topics · go back & change answers"
           : isWrong ? `Replay your ${wrongCount} saved wrong answers · no new AI questions`
           : "AI-generated from your notes · answers shown at end"}
        </p>
      </div>
      {isMock && (
        <div style={{ marginBottom:28 }}>
          <p style={{ fontWeight:700, color:"#374151", fontSize:14, marginBottom:12 }}>Timer setting</p>
          <div style={{ display:"flex", gap:12 }}>
            {[{val:true,icon:"⏱️",label:"Timed",sub:"60 minutes"},{val:false,icon:"📖",label:"Untimed",sub:"Study mode"}].map(o => (
              <button key={String(o.val)} onClick={() => setTimed(o.val)} style={{ flex:1, padding:16, border:"2px solid", borderColor:timed===o.val?C.blue:"#e2e8f0", background:timed===o.val?"#eff6ff":"#fff", borderRadius:12, cursor:"pointer", textAlign:"center" }}>
                <div style={{ fontSize:22, marginBottom:4 }}>{o.icon}</div>
                <div style={{ fontWeight:700, color:"#1e293b", fontSize:14 }}>{o.label}</div>
                <div style={{ color:C.slate, fontSize:12 }}>{o.sub}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{ marginBottom:24 }}>
        <p style={{ fontWeight:700, color:"#374151", fontSize:14, marginBottom:12 }}>Number of questions</p>
        <div style={{ display:"flex", gap:8 }}>
          {countOptions.map(n => (
            <button key={n} onClick={() => setCount(n)} style={{ flex:1, padding:"10px 6px", border:"2px solid", borderColor:count===n?C.blue:"#e2e8f0", background:count===n?"#eff6ff":"#fff", borderRadius:10, cursor:"pointer", fontWeight:count===n?700:500, color:count===n?"#1e40af":"#374151", fontSize:15 }}>
              {n}
            </button>
          ))}
          {isWrong && wrongCount > 0 && !countOptions.includes(wrongCount) && (
            <button onClick={() => setCount(wrongCount)} style={{ flex:1, padding:"10px 6px", border:"2px solid", borderColor:count===wrongCount?C.blue:"#e2e8f0", background:count===wrongCount?"#eff6ff":"#fff", borderRadius:10, cursor:"pointer", fontWeight:count===wrongCount?700:500, color:count===wrongCount?"#1e40af":"#374151", fontSize:15 }}>
              All {wrongCount}
            </button>
          )}
        </div>
      </div>
      <div style={{ background:"#f8fafc", borderRadius:12, padding:14, marginBottom:24, border:"1px solid #e2e8f0", fontSize:13, color:"#475569", lineHeight:1.6 }}>
        <strong style={{ color:"#1e293b" }}>Rules:</strong> 1 correct answer · No negative marking · Go back to change answers{isMock&&timed?" · 60 minute timer":""}
      </div>
      <button onClick={() => onStart(isMock ? timed : false, count)} style={{ width:"100%", padding:15, background:C.navy, color:"#fff", border:"none", borderRadius:14, fontSize:16, fontWeight:700, cursor:"pointer" }}>
        Begin {isMock ? "Exam" : "Quiz"} ({count} questions) →
      </button>
    </div>
  );
}
// ── LOADING ───────────────────────────────────────────────────────────────
function Loading({ message = "Generating questions", subtitle = "Crafting exam-standard questions from your notes. About 20 seconds." }) {
  const [dots, setDots] = useState("");
  useEffect(() => { const i = setInterval(()=>setDots(d=>d.length>=3?"":d+"."),500); return ()=>clearInterval(i); }, []);
  return (
    <div style={{ maxWidth:420, margin:"100px auto", padding:40, textAlign:"center" }} className="fadein">
      <div style={{ fontSize:56, marginBottom:20 }}>🏛️</div>
      <div style={{ width:44, height:44, border:`4px solid #e2e8f0`, borderTopColor:C.blue, borderRadius:"50%", margin:"0 auto 20px", animation:"spin .75s linear infinite" }} />
      <h2 style={{ color:C.navy, fontSize:18, fontWeight:700, marginBottom:8 }}>{message}{dots}</h2>
      <p style={{ color:C.slate, fontSize:14 }}>{subtitle}</p>
    </div>
  );
}
// ── QUIZ ──────────────────────────────────────────────────────────────────
function Quiz({ questions, timed, onFinish, onExit }) {
  const [cur, setCur] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flags, setFlags] = useState({});
  const [timeLeft, setTimeLeft] = useState(60*60);
  const [navOpen, setNavOpen] = useState(false);
  const timerRef = useRef(null);
  const submittedRef = useRef(false);
  const doSubmit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    clearInterval(timerRef.current);
    onFinish(questions.map((q,i) => ({ question:q, userAnswer:answers[i]!==undefined?answers[i]:null, correct:answers[i]===q.correct, manualFlag:!!flags[i] })));
  }, [answers, flags, questions, onFinish]);
  useEffect(() => {
    if (!timed) return;
    timerRef.current = setInterval(() => setTimeLeft(t => { if(t<=1){doSubmit();return 0;} return t-1; }), 1000);
    return () => clearInterval(timerRef.current);
  }, [timed, doSubmit]);
  const q = questions[cur];
  const answered = Object.keys(answers).length;
  const unanswered = questions.length - answered;
  const formatTime = s => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`;
  const timeColor = timeLeft<600?C.red:timeLeft<1200?C.amber:C.green;
  return (
    <div style={{ maxWidth:680, margin:"0 auto", padding:"16px 16px 80px" }} className="fadein">
      <div style={{ position:"sticky", top:8, zIndex:10, background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", padding:"11px 16px", marginBottom:18, display:"flex", alignItems:"center", gap:14, boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}>
        <span style={{ fontSize:13, fontWeight:700, color:C.navy, flexShrink:0 }}>Q{cur+1}/{questions.length}</span>
        <div style={{ flex:1 }}><Bar pct={(answered/questions.length)*100} /></div>
        {timed
          ? <span style={{ fontSize:15, fontWeight:800, color:timeColor, flexShrink:0, minWidth:56 }}>⏱ {formatTime(timeLeft)}</span>
          : <span style={{ fontSize:13, color:"#94a3b8", flexShrink:0 }}>{answered}/{questions.length} done</span>
        }
        <button onClick={onExit} style={{ background:"none", border:"1px solid #e2e8f0", borderRadius:8, padding:"4px 10px", cursor:"pointer", color:"#94a3b8", fontSize:13, fontWeight:600, flexShrink:0 }}>✕ Exit</button>
      </div>
      <div style={{ background:"#fff", borderRadius:16, padding:"22px 22px 18px", border:"2px solid #e2e8f0", marginBottom:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
          <TopicBadge topic={q.topic} />
          <button onClick={() => setFlags(f=>({...f,[cur]:!f[cur]}))} style={{ background:flags[cur]?"#fef3c7":"#f8fafc", border:`1px solid ${flags[cur]?C.amber:"#e2e8f0"}`, borderRadius:8, padding:"4px 12px", cursor:"pointer", fontSize:13, color:flags[cur]?C.amber:"#94a3b8", fontWeight:600 }}>
            {flags[cur]?"🚩 Flagged":"⚑ Flag"}
          </button>
        </div>
        <p style={{ fontSize:16, fontWeight:600, color:"#1e293b", lineHeight:1.55, marginBottom:18 }}>{q.question}</p>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {q.options.map((opt,i) => {
            const sel = answers[cur]===i;
            return <button key={i} onClick={() => setAnswers(a=>({...a,[cur]:i}))} style={{ padding:"13px 16px", border:"2px solid", borderColor:sel?C.blue:"#e2e8f0", background:sel?"#eff6ff":"#fafafa", borderRadius:12, cursor:"pointer", textAlign:"left", fontSize:15, color:sel?"#1e40af":"#374151", fontWeight:sel?600:400, display:"flex", alignItems:"flex-start", gap:12, transition:"all .12s" }}
              onMouseEnter={e=>{if(!sel){e.currentTarget.style.borderColor="#93c5fd";e.currentTarget.style.background="#f0f9ff";}}}
              onMouseLeave={e=>{if(!sel){e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.background="#fafafa";}}}>
              <span style={{ width:26, height:26, borderRadius:"50%", flexShrink:0, background:sel?C.blue:"#e2e8f0", color:sel?"#fff":C.slate, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700 }}>
                {["A","B","C","D"][i]}
              </span>
              <span style={{ paddingTop:2 }}>{opt}</span>
            </button>;
          })}
        </div>
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:12 }}>
        <button onClick={()=>setCur(c=>Math.max(0,c-1))} disabled={cur===0} style={{ flex:1, padding:13, border:"2px solid #e2e8f0", background:"#fff", borderRadius:12, cursor:cur===0?"not-allowed":"pointer", color:cur===0?"#cbd5e1":"#374151", fontWeight:600, fontSize:15 }}>← Prev</button>
        {cur < questions.length-1
          ? <button onClick={()=>setCur(c=>c+1)} style={{ flex:2, padding:13, background:C.blue, color:"#fff", border:"none", borderRadius:12, cursor:"pointer", fontWeight:700, fontSize:15 }}>Next →</button>
          : <button onClick={doSubmit} style={{ flex:2, padding:13, background:unanswered>0?C.amber:C.green, color:"#fff", border:"none", borderRadius:12, cursor:"pointer", fontWeight:700, fontSize:15 }}>{unanswered>0?`Submit (${unanswered} unanswered)`:"✓ Submit"}</button>
        }
      </div>
      <button onClick={()=>setNavOpen(!navOpen)} style={{ width:"100%", padding:11, border:"1px solid #e2e8f0", background:"#f8fafc", borderRadius:10, cursor:"pointer", color:C.slate, fontSize:13, fontWeight:600 }}>
        {navOpen?"Hide":"Show"} Question Navigator
      </button>
      {navOpen && (
        <div style={{ marginTop:10, padding:14, background:"#fff", borderRadius:12, border:"1px solid #e2e8f0", display:"flex", flexWrap:"wrap", gap:7 }}>
          {questions.map((_,i) => {
            const isAns=answers[i]!==undefined, isFl=flags[i], isCur=i===cur;
            return <button key={i} onClick={()=>setCur(i)} style={{ width:34, height:34, borderRadius:8, border:"2px solid", borderColor:isCur?C.blue:isFl?C.amber:isAns?"#86efac":"#e2e8f0", background:isCur?C.blue:isFl?"#fef3c7":isAns?"#f0fdf4":"#fff", color:isCur?"#fff":"#374151", fontWeight:isCur?700:500, fontSize:12, cursor:"pointer" }}>{i+1}</button>;
          })}
          <div style={{ width:"100%", marginTop:6, fontSize:11, color:"#94a3b8", display:"flex", gap:12 }}>
            <span>🟦 Current</span><span>🟩 Done</span><span>🟨 Flagged</span><span>⬜ Blank</span>
          </div>
        </div>
      )}
    </div>
  );
}
// ── RESULTS ───────────────────────────────────────────────────────────────
function Results({ results, onDash, onRetry }) {
  const [filter, setFilter] = useState("wrong");
  const [showAll, setShowAll] = useState(false);
  const total = results.length;
  const correct = results.filter(r=>r.correct).length;
  const pct = Math.round((correct/total)*100);
  const topicStats = {};
  results.forEach(r => {
    const t = r.question.topic||"General";
    if(!topicStats[t]) topicStats[t]={correct:0,total:0};
    topicStats[t].total++;
    if(r.correct) topicStats[t].correct++;
  });
  const grade = pct>=80?{label:"Excellent! 🏆",color:C.green,bg:"#d1fae5"}
    :pct>=65?{label:"Good work 👍",color:C.blue,bg:"#dbeafe"}
    :pct>=50?{label:"Passing 📈",color:C.amber,bg:"#fef3c7"}
    :{label:"Keep studying 💪",color:C.red,bg:"#fee2e2"};
  const filtered = filter==="all"?results:filter==="wrong"?results.filter(r=>!r.correct):results.filter(r=>r.manualFlag);
  const visible = showAll ? filtered : filtered.slice(0,6);
  return (
    <div style={{ maxWidth:680, margin:"0 auto", padding:"24px 16px 60px" }} className="fadein">
      <div style={{ background:`linear-gradient(135deg,${C.navy},${C.blue})`, borderRadius:20, padding:"30px 24px", textAlign:"center", color:"#fff", marginBottom:22 }}>
        <div style={{ fontSize:58, fontWeight:900, lineHeight:1 }}>{pct}%</div>
        <div style={{ display:"inline-block", padding:"5px 16px", borderRadius:99, background:grade.bg, color:grade.color, fontWeight:700, fontSize:14, marginTop:10 }}>{grade.label}</div>
        <div style={{ marginTop:10, opacity:.9 }}>{correct} of {total} correct</div>
      </div>
      <div style={{ background:"#fff", borderRadius:16, padding:20, border:"2px solid #e2e8f0", marginBottom:18 }}>
        <h3 style={{ fontSize:15, fontWeight:700, color:C.navy, marginBottom:14 }}>📊 Topic Breakdown</h3>
        {Object.entries(topicStats).sort((a,b)=>(a[1].correct/a[1].total)-(b[1].correct/b[1].total)).map(([topic,s]) => {
          const p=Math.round((s.correct/s.total)*100), col=p>=75?C.green:p>=50?C.amber:C.red;
          return <div key={topic} style={{ marginBottom:11 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:13, color:"#374151" }}>{topic}</span>
              <span style={{ fontSize:13, fontWeight:700, color:col }}>{p}% ({s.correct}/{s.total})</span>
            </div>
            <Bar pct={p} color={col} />
          </div>;
        })}
      </div>
      <div style={{ background:"#fff", borderRadius:16, border:"2px solid #e2e8f0", overflow:"hidden", marginBottom:20 }}>
        <div style={{ padding:"16px 20px 12px", borderBottom:"1px solid #f1f5f9" }}>
          <h3 style={{ fontSize:15, fontWeight:700, color:C.navy, marginBottom:12 }}>Review Questions</h3>
          <div style={{ display:"flex", gap:8 }}>
            {[["all",`All (${total})`],["wrong",`Wrong (${results.filter(r=>!r.correct).length})`],["flagged",`Flagged (${results.filter(r=>r.manualFlag).length})`]].map(([f,label]) => (
              <button key={f} onClick={()=>{setFilter(f);setShowAll(false);}} style={{ padding:"6px 14px", border:"2px solid", borderColor:filter===f?C.blue:"#e2e8f0", background:filter===f?"#eff6ff":"#fff", borderRadius:99, cursor:"pointer", fontSize:13, color:filter===f?"#1e40af":C.slate, fontWeight:filter===f?700:500 }}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{ padding:"10px 20px" }}>
          {visible.map((r,i) => (
            <div key={i} style={{ padding:"14px 0", borderBottom:i<visible.length-1?"1px solid #f8fafc":"none" }}>
              <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <span style={{ fontSize:20, flexShrink:0, marginTop:1 }}>{r.correct?"✅":"❌"}</span>
                <div style={{ flex:1 }}>
                  <div style={{ marginBottom:6 }}><TopicBadge topic={r.question.topic} /></div>
                  <p style={{ fontSize:14, color:"#1e293b", fontWeight:500, lineHeight:1.5, marginBottom:8 }}>{r.question.question}</p>
                  {!r.correct && r.userAnswer!==null && <p style={{ fontSize:13, color:C.red, marginBottom:4 }}>Your answer: {r.question.options[r.userAnswer]}</p>}
                  {!r.correct && r.userAnswer===null && <p style={{ fontSize:13, color:"#94a3b8", marginBottom:4 }}>Not answered</p>}
                  <p style={{ fontSize:13, color:C.green, fontWeight:600, marginBottom:6 }}>✓ Correct: {r.question.options[r.question.correct]}</p>
                  <p style={{ fontSize:13, color:C.slate, lineHeight:1.55, background:"#f8fafc", padding:"8px 12px", borderRadius:8 }}>{r.question.explanation}</p>
                </div>
              </div>
            </div>
          ))}
          {!showAll && filtered.length > 6 && (
            <button onClick={()=>setShowAll(true)} style={{ width:"100%", padding:12, border:"none", background:"#f8fafc", borderRadius:8, cursor:"pointer", color:C.blue, fontSize:14, fontWeight:600, marginTop:8 }}>
              Show {filtered.length-6} more →
            </button>
          )}
          {filtered.length===0 && <p style={{ textAlign:"center", color:"#94a3b8", padding:"20px 0" }}>Nothing to show here 🎉</p>}
        </div>
      </div>
      <div style={{ display:"flex", gap:12 }}>
        <button onClick={onDash} style={{ flex:1, padding:14, border:"2px solid #e2e8f0", background:"#fff", borderRadius:12, cursor:"pointer", color:"#374151", fontWeight:600, fontSize:15 }}>← Dashboard</button>
        <button onClick={onRetry} style={{ flex:1, padding:14, background:C.navy, color:"#fff", border:"none", borderRadius:12, cursor:"pointer", fontWeight:700, fontSize:15 }}>New Quiz →</button>
      </div>
    </div>
  );
}
// ── ROOT APP ──────────────────────────────────────────────────────────────
function App() {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
  const [screen, setScreen] = useState("init");
  const [setup, setSetup] = useState(null);
  const [stats, setStats] = useState({ totalAttempted:0, totalCorrect:0, topicStats:{}, wrongQuestions:[], sessionHistory:[] });
  const [questions, setQuestions] = useState([]);
  const [results, setResults] = useState([]);
  const [mode, setMode] = useState(null);
  const [activeTopic, setActiveTopic] = useState(null);
  const [timed, setTimed] = useState(false);
  const [error, setError] = useState(null);
  const [loadingMsg, setLoadingMsg] = useState("Loading…");
  useEffect(() => {
    const saved = loadSaved();
    if (saved?.setup) {
      setSetup(saved.setup);
      setStats(saved.stats || { totalAttempted:0, totalCorrect:0, topicStats:{}, wrongQuestions:[], sessionHistory:[] });
      setScreen("dashboard");
    } else {
      // First visit — use pre-extracted course data (instant, no API calls needed)
      const setup = { notes: COURSE_NOTES, faculty: COURSE_FACULTY, topics: DEFAULT_TOPICS, priorityNotes: PRIORITY_NOTES };
      const stats = { totalAttempted:0, totalCorrect:0, topicStats:{}, wrongQuestions:[], sessionHistory:[] };
      persist({ setup, stats });
      setSetup(setup);
      setStats(stats);
      setScreen("dashboard");
    }
  }, []);
  const save = useCallback((s, st) => persist({ setup:s, stats:st }), []);
  const handleSaveSetup = (data) => { setSetup(data); save(data, stats); setScreen("dashboard"); };
  const updateStats = useCallback((res) => {
    setStats(prev => {
      const newTopicStats = {...prev.topicStats};
      res.forEach(r => {
        const t=r.question.topic||"General";
        if(!newTopicStats[t]) newTopicStats[t]={correct:0,total:0};
        newTopicStats[t].total++;
        if(r.correct) newTopicStats[t].correct++;
      });
      const wrongQs=[...(prev.wrongQuestions||[])];
      res.forEach(r => { if(!r.correct&&!r.question.isFaculty&&!wrongQs.find(q=>q.question===r.question.question)) wrongQs.push(r.question); });
      const newStats = { ...prev, totalAttempted:(prev.totalAttempted||0)+res.length, totalCorrect:(prev.totalCorrect||0)+res.filter(r=>r.correct).length, topicStats:newTopicStats, wrongQuestions:wrongQs.slice(0,60), sessionHistory:[...(prev.sessionHistory||[]),{date:new Date().toISOString(),mode,score:res.filter(r=>r.correct).length,total:res.length}].slice(-20) };
      save(setup, newStats);
      return newStats;
    });
  }, [mode, setup, save]);
  const launchMock = async (isTimed, count = 40) => {
    setTimed(isTimed); setMode("mock"); setScreen("loading"); setError(null);
    try {
      const aiCount = Math.max(count - FACULTY_QUESTIONS.length, 1);
      const aiQs = await generateQuestions(apiKey, setup.notes, setup.topics, aiCount, [], setup.faculty||"", setup.outline||"", null, setup.priorityNotes||"");
      setQuestions([...FACULTY_QUESTIONS,...aiQs].sort(()=>Math.random()-.5).slice(0, count));
      setScreen("quiz");
    } catch(e) { setError("Could not generate questions: " + e.message); setScreen("dashboard"); }
  };
  const launchTopic = async (_, count = 10) => {
    setMode("topic"); setScreen("loading"); setError(null);
    try {
      setQuestions(await generateQuestions(apiKey, setup.notes, [activeTopic], count, [], setup.faculty||"", "", activeTopic.name, setup.priorityNotes||""));
      setScreen("quiz");
    } catch(e) { setError("Could not generate questions: " + e.message); setScreen("dashboard"); }
  };
  const launchWeak = async () => {
    setMode("weak"); setTimed(false); setScreen("loading"); setError(null);
    try {
      setQuestions(await generateWeakQuestions(apiKey, setup.notes, stats.wrongQuestions||[], setup.topics, setup.priorityNotes||""));
      setScreen("quiz");
    } catch(e) { setError("Could not generate questions: " + e.message); setScreen("dashboard"); }
  };
  const launchWrongOnly = (_, count = 10) => {
    const wrongQs = stats.wrongQuestions || [];
    const shuffled = [...wrongQs].sort(() => Math.random() - .5);
    setQuestions(shuffled.slice(0, Math.min(count, wrongQs.length)));
    setMode("wrong-only");
    setTimed(false);
    setScreen("quiz");
  };
  const handleFinish = (res) => { setResults(res); updateStats(res); setScreen("results"); };
  if (screen==="init"||screen==="loading") return <Loading message={screen==="loading"?"Generating questions":"Loading"} />;
  if (screen==="preloading") return <Loading message={loadingMsg} subtitle="Loading your course materials — this only happens once" />;
  if (screen==="setup") return <Setup existing={setup} onSave={handleSaveSetup} apiKey={apiKey} />;
  if (screen==="dashboard") return <Dashboard setup={setup} stats={stats} error={error} onMock={()=>setScreen("config_mock")} onTopic={t=>{setActiveTopic(t);setScreen("config_topic");}} onWeak={launchWeak} onWrongOnly={()=>setScreen("config_wrong")} onEditSetup={()=>setScreen("setup")} />;
  if (screen==="config_mock") return <ExamConfig mode="mock" onStart={launchMock} onBack={()=>setScreen("dashboard")} />;
  if (screen==="config_topic") return <ExamConfig mode="topic" topicName={activeTopic?.name} onStart={launchTopic} onBack={()=>setScreen("dashboard")} />;
  if (screen==="config_wrong") return <ExamConfig mode="wrong" onStart={launchWrongOnly} onBack={()=>setScreen("dashboard")} wrongCount={stats.wrongQuestions?.length||0} />;
  if (screen==="quiz") return <Quiz questions={questions} timed={timed} onFinish={handleFinish} onExit={()=>setScreen("dashboard")} />;
  if (screen==="results") return <Results results={results} onDash={()=>setScreen("dashboard")} onRetry={()=>setScreen("dashboard")} />;
  return null;
}

export default App;
