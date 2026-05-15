let state = JSON.parse(localStorage.getItem('awsQuizState') || '{}');
let notes = JSON.parse(localStorage.getItem('awsQuizNotes') || '{}');
const totalQ = 719;

function renderQuestions() {
    const container = document.getElementById('questions');
    const frag = document.createDocumentFragment();
    for (const q of QUESTIONS) {
        const n = q.num;
        const div = document.createElement('div');
        div.className = 'question';
        div.id = 'q' + n;
        div.dataset.answer = q.answer;

        let optionsHTML = '';
        for (const [letter, text] of Object.entries(q.options)) {
            optionsHTML += `<label class="option" id="q${n}_${letter}">
    <input type="radio" name="q${n}" value="${letter}" onchange="selectOption(${n},'${letter}')">
    <span class="option-box" aria-hidden="true"></span>
    <span class="option-label">${letter}. ${text}</span>
  </label>`;
        }

        div.innerHTML = `
  <div class="q-header"><span>Question #${n}</span>
    <div>
      <button class="btn btn-check" id="checkBtn${n}" onclick="checkQuestion(${n})">Show Answer</button>
      <button class="btn btn-reset-one" onclick="resetQuestion(${n})">Reset</button>
    </div>
  </div>
  <div class="q-text">${q.text}</div>
  ${optionsHTML}
  <div class="result" id="result${n}"></div>
  <div class="notes-section">
    <div class="notes-toggle" id="notesToggle${n}" onclick="toggleNotes(${n})">Notes</div>
    <textarea class="notes-area" id="notes${n}" placeholder="Write your notes here..." oninput="saveNote(${n})"></textarea>
  </div>`;
        frag.appendChild(div);
    }
    container.appendChild(frag);
}

window.addEventListener('load', function() {
    renderQuestions();

    for (let qNum in state) {
        let radio = document.querySelector('input[name="q' + qNum + '"][value="' + state[qNum].selected + '"]');
        if (radio) radio.checked = true;
        if (state[qNum].checked) checkQuestion(parseInt(qNum), true);
    }
    for (let qNum in notes) {
        let textarea = document.getElementById('notes' + qNum);
        if (textarea && notes[qNum]) {
            textarea.value = notes[qNum];
            textarea.classList.add('show');
            let toggle = document.getElementById('notesToggle' + qNum);
            if (toggle) toggle.classList.add('has-notes');
        }
    }
    updateStats();
});

function selectOption(qNum, letter) {
    if (!state[qNum]) state[qNum] = {};
    state[qNum].selected = letter;
    localStorage.setItem('awsQuizState', JSON.stringify(state));
    document.querySelectorAll('#q' + qNum + ' .option').forEach(o => o.classList.remove('selected'));
    document.getElementById('q' + qNum + '_' + letter).classList.add('selected');
}

function checkQuestion(qNum, silent) {
    let qDiv = document.getElementById('q' + qNum);
    let answer = qDiv.dataset.answer;
    let selected = state[qNum] ? state[qNum].selected : null;
    let resultDiv = document.getElementById('result' + qNum);
    if (!selected && !silent) { 
        resultDiv.className = 'result show wrong';
        resultDiv.textContent = 'Select an answer first — Correct: ' + answer;
        return; 
    }
    if (!selected) return;
    let isCorrect = selected === answer;
    qDiv.querySelectorAll('.option').forEach(o => o.classList.remove('show-correct', 'show-wrong'));
    let correctOpt = document.getElementById('q' + qNum + '_' + answer);
    if (correctOpt) correctOpt.classList.add('show-correct');
    if (!isCorrect) {
        let wrongOpt = document.getElementById('q' + qNum + '_' + selected);
        if (wrongOpt) wrongOpt.classList.add('show-wrong');
    }
    qDiv.classList.remove('answered-correct', 'answered-wrong');
    qDiv.classList.add(isCorrect ? 'answered-correct' : 'answered-wrong');
    resultDiv.className = 'result show ' + (isCorrect ? 'correct' : 'wrong');
    resultDiv.textContent = isCorrect ? 'Correct.' : 'Wrong — Correct: ' + answer;
    let btn = document.getElementById('checkBtn' + qNum);
    btn.disabled = true;
    btn.textContent = isCorrect ? 'OK' : 'X';
    if (!state[qNum]) state[qNum] = {};
    state[qNum].checked = true;
    localStorage.setItem('awsQuizState', JSON.stringify(state));
    updateStats();
}

function resetQuestion(qNum) {
    let qDiv = document.getElementById('q' + qNum);
    qDiv.classList.remove('answered-correct', 'answered-wrong');
    qDiv.querySelectorAll('.option').forEach(o => o.classList.remove('show-correct', 'show-wrong', 'selected'));
    qDiv.querySelectorAll('input[type=radio]').forEach(r => r.checked = false);
    let resultDiv = document.getElementById('result' + qNum);
    resultDiv.className = 'result';
    resultDiv.textContent = '';
    let btn = document.getElementById('checkBtn' + qNum);
    btn.disabled = false;
    btn.textContent = 'Show Answer';
    delete state[qNum];
    localStorage.setItem('awsQuizState', JSON.stringify(state));
    updateStats();
}

function resetAll() {
    if (!confirm('確定要重置所有題目嗎？筆記會保留。')) return;
    state = {};
    localStorage.setItem('awsQuizState', '{}');
    document.querySelectorAll('.question').forEach(qDiv => {
        let qNum = parseInt(qDiv.id.replace('q',''));
        qDiv.classList.remove('answered-correct', 'answered-wrong');
        qDiv.querySelectorAll('.option').forEach(o => o.classList.remove('show-correct', 'show-wrong', 'selected'));
        qDiv.querySelectorAll('input[type=radio]').forEach(r => r.checked = false);
        let resultDiv = document.getElementById('result' + qNum);
        resultDiv.className = 'result'; resultDiv.textContent = '';
        let btn = document.getElementById('checkBtn' + qNum);
        btn.disabled = false; btn.textContent = 'Show Answer';
    });
    updateStats();
}

function toggleNotes(qNum) {
    let textarea = document.getElementById('notes' + qNum);
    textarea.classList.toggle('show');
    if (textarea.classList.contains('show')) textarea.focus();
}

function saveNote(qNum) {
    let textarea = document.getElementById('notes' + qNum);
    let toggle = document.getElementById('notesToggle' + qNum);
    notes[qNum] = textarea.value;
    localStorage.setItem('awsQuizNotes', JSON.stringify(notes));
    toggle.classList.toggle('has-notes', textarea.value.length > 0);
}

function jumpToQ() {
    let num = document.getElementById('jumpTo').value;
    let el = document.getElementById('q' + num);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateStats() {
    let correct = 0, wrong = 0, answered = 0;
    document.querySelectorAll('.question').forEach(qDiv => {
        if (qDiv.classList.contains('answered-correct')) { correct++; answered++; }
        else if (qDiv.classList.contains('answered-wrong')) { wrong++; answered++; }
    });
    document.getElementById('correct').textContent = correct;
    document.getElementById('wrong').textContent = wrong;
    document.getElementById('unanswered').textContent = totalQ - answered;
    document.getElementById('progressFill').style.width = (answered / totalQ * 100) + '%';
}
