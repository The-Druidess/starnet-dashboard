/* STARNET — windows/q.js: Q's local owner inbox and programmable response terminal. */
'use strict';
(() => {
  if (typeof StationUI === 'undefined' || !StationUI.registerWindow) return;
  const H = StationUI.h;
  const esc = H.esc;
  const store = () => (typeof QTerminalStore !== 'undefined' ? QTerminalStore : null);
  const agentName = id => {
    const agent = (Array.isArray(H.present) ? H.present.find(row => row && row.id === id) : null);
    return agent ? (agent.name || id) : id;
  };
  const timeLabel = timestamp => {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? 'time unknown' : date.toLocaleString();
  };
  let selectedId = '';

  function buildQ(body) {
    globalThis.QTerminalView = { refresh: () => { if (body.isConnected) { selectedId = ''; buildQ(body); } } };
    const Q = store();
    if (!Q) { body.innerHTML = '<p class="dim">Q terminal storage is unavailable.</p>'; return; }
    const rows = Q.messages().sort((a, b) => b.createdAt - a.createdAt);
    if (!rows.some(row => row.id === selectedId)) selectedId = rows[0] ? rows[0].id : '';
    const selected = rows.find(row => row.id === selectedId) || null;
    const inbox = rows.length ? rows.map(row =>
      '<button type="button" class="q-inbox-row' + (row.id === selectedId ? ' selected' : '') + '" data-q-select="' + esc(row.id) + '">' +
        '<span class="q-inbox-meta"><b>' + esc(agentName(row.agentId)) + '</b><span>' + esc(row.kind.toUpperCase()) + ' · ' + esc(timeLabel(row.createdAt)) + '</span></span>' +
        '<span class="q-inbox-preview">' + esc(row.text) + '</span><span class="q-inbox-status">' + (row.status === 'replied' ? 'REPLIED' : row.status === 'queued' ? 'QUEUED TO COMMS' : 'AWAITING YOU') + '</span>' +
      '</button>').join('') : '<p class="q-empty">No agent messages yet. Questions and notes sent with Q will appear here.</p>';
    const selectedMarkup = selected
      ? '<section class="q-message-detail"><h4>' + esc(agentName(selected.agentId)) + ' · ' + esc(selected.kind.toUpperCase()) + '</h4>' +
          '<p class="q-message-body">' + esc(selected.text) + '</p>' +
          (selected.kind === 'command' && selected.matchedResponse ? '<div class="q-command-match"><b>EXACT RESPONSE MATCH</b><p>' + esc(selected.matchedResponse) + '</p><button type="button" class="bb sm" data-q-action="send-match"' + (selected.status !== 'pending' ? ' disabled' : '') + '>SEND MATCHED RESPONSE</button></div>' : '') +
          (selected.kind === 'directive' ? '<div class="q-command-match"><b>PRIME DIRECTIVE REQUEST</b><button type="button" class="bb sm" data-q-action="send-directive"' + (!Q.directive() || selected.status !== 'pending' ? ' disabled' : '') + '>SEND PRIME DIRECTIVE</button></div>' : '') +
          (selected.status === 'replied' ? '<p class="q-replied">Sent: ' + esc(selected.response || 'response sent') + '</p>' :
            selected.status === 'queued' ? '<p class="q-replied">Queued in COMMS: ' + esc(selected.response || 'response queued') + '</p>' :
            '<label class="q-label" for="q-reply">REPLY TO ' + esc(agentName(selected.agentId)).toUpperCase() + '</label><textarea id="q-reply" class="q-textarea" maxlength="4000" placeholder="Write a reply or answer their question…"></textarea><button type="button" class="bb sm" data-q-action="send-reply">SEND REPLY</button> ' +
            '<button type="button" class="bb sm" data-q-action="open-agent">OPEN AGENT COMMS</button>') +
        '</section>'
      : '<section class="q-message-detail"><p class="q-empty">Select an inbox item to review it.</p></section>';
    const commandMarkup = Q.commands().map(command =>
      '<div class="q-command-row" data-q-command="' + esc(command.id) + '">' +
        '<label>EXACT COMMAND<input class="q-input" data-q-field="command" maxlength="200" value="' + esc(command.command) + '"></label>' +
        '<label>RESPONSE<textarea class="q-textarea" data-q-field="response" maxlength="4000">' + esc(command.response) + '</textarea></label>' +
        '<button type="button" class="bb xs" data-q-action="save-command">SAVE</button> <button type="button" class="bb xs danger" data-q-action="delete-command">REMOVE</button>' +
      '</div>').join('');
    const roleDirectiveMarkup = Q.parseHierarchy(Q.hierarchy()).entries
      .filter(entry => entry.role !== 'commander-q')
      .map(entry => '<div class="q-settings"><h4>' + esc(entry.name.toLocaleUpperCase()) + ' · LEVEL ' + entry.level + ' DIRECTIVE</h4>' +
        '<p class="q-help">Saved in Q and included in the standing instructions for agents assigned to this roster role.</p>' +
        '<textarea class="q-textarea" data-q-role-directive="' + esc(entry.role) + '" maxlength="8000" placeholder="Add the role-specific directive when ready…">' + esc(Q.roleDirective(entry.role)) + '</textarea>' +
        '<button type="button" class="bb sm" data-q-action="save-role-directive" data-q-role="' + esc(entry.role) + '">SAVE ' + esc(entry.name.toLocaleUpperCase()) + ' DIRECTIVE</button></div>')
      .join('');
    body.innerHTML =
      '<div class="q-terminal">' +
        '<header class="q-header"><div><span class="q-kicker">COMMANDER’S LOCAL INBOX</span><h3>Q · COMMUNICATIONS TERMINAL</h3></div><span class="q-count">' + rows.filter(row => row.status === 'pending').length + ' AWAITING</span></header>' +
        '<p class="q-intro">Agents can send notes, ask questions, submit exact commands, or request saved Q reference material. Q’s human operating directive and the Prime Directive are included in every agent’s standing instructions; role directives are included for matching agents. Q saves its inbox and settings locally; replies use the agent’s existing COMMS channel.</p>' +
        '<div class="q-inbox-layout"><div class="q-inbox-list" aria-label="Q inbox">' + inbox + '</div>' + selectedMarkup + '</div>' +
        '<section class="q-settings"><h4>PRIME DIRECTIVE · PROJECT-WIDE RULE BASE</h4><p class="q-help">The USS Theseus default is included in every agent’s standing instructions. Edit and save it to customize the shared goals and rules; it cannot be left empty or grant tools or permissions. Choosing SEND PRIME DIRECTIVE sends a copy into that agent’s COMMS.</p>' +
          '<textarea id="q-directive" class="q-textarea" maxlength="8000" placeholder="Write the shared goals and rules agents should follow across this project…">' + esc(Q.directive()) + '</textarea>' +
          '<button type="button" class="bb sm" data-q-action="save-directive">SAVE PRIME DIRECTIVE</button>' +
        '</section>' +
        '<section class="q-settings"><h4>Q · HUMAN OPERATING DIRECTIVE</h4><p class="q-help">This is Q’s stated commitment for leading and engaging with the crew. It is included in every agent’s standing instructions as context, not as a substitute for confirmed decisions, authority limits, or higher-priority instructions. Agents can request a copy with Q_HUMAN_DIRECTIVE_REQUEST.</p>' +
          '<textarea id="q-human-directive" class="q-textarea" maxlength="8000" placeholder="Describe how Q will lead and engage with the crew…">' + esc(Q.qDirective()) + '</textarea>' +
          '<button type="button" class="bb sm" data-q-action="save-q-directive">SAVE Q DIRECTIVE</button>' +
        '</section>' +
        '<section class="q-settings"><h4>BRIDGE CREW HIERARCHY ROSTER</h4><p class="q-help">Only Q (you, Level 0) may change this roster; agent requests cannot edit it. Lower-numbered levels outrank higher-numbered levels, and unlisted agents rank below every listed role. Levels define rank only; other permissions are not defined yet. The roster is included in every agent’s Q reference; agents can request a copy with Q_HIERARCHY_REQUEST.</p>' +
          '<textarea id="q-hierarchy" class="q-textarea" maxlength="6000">' + esc(Q.hierarchy()) + '</textarea>' +
          '<button type="button" class="bb sm" data-q-action="save-hierarchy">SAVE HIERARCHY ROSTER</button>' +
        '</section>' +
        '<section class="q-settings"><h4>BRIDGE CREW ROLE DIRECTIVES</h4><p class="q-help">Each saved directive is added to the matching agent’s standing instructions and remains available through Q_ROLE_DIRECTIVE_REQUEST. Empty roles remain unset until you provide their text.</p>' +
          roleDirectiveMarkup +
        '</section>' +
        '<section class="q-settings"><h4>PROGRAMMED COMMAND RESPONSES</h4><p class="q-help">Responses match the command text exactly (case-sensitive). Q offers a match for you to send.</p>' +
          '<div class="q-command-list">' + commandMarkup + '</div>' +
          '<div class="q-command-row q-command-new"><label>EXACT COMMAND<input class="q-input" id="q-new-command" maxlength="200" placeholder="e.g. request status"></label>' +
          '<label>RESPONSE<textarea class="q-textarea" id="q-new-response" maxlength="4000" placeholder="The exact response Q should offer…"></textarea></label>' +
          '<button type="button" class="bb sm" data-q-action="add-command">ADD RESPONSE</button></div>' +
        '</section>' +
      '</div>';
    body.onclick = event => {
      const select = event.target.closest('[data-q-select]');
      if (select) { selectedId = select.dataset.qSelect; buildQ(body); return; }
      const button = event.target.closest('[data-q-action]');
      if (!button) return;
      const action = button.dataset.qAction;
      const selectedNow = Q.messages().find(row => row.id === selectedId);
      try {
        if (action === 'save-directive') {
          const result = Q.setDirective(body.querySelector('#q-directive').value);
          if (!result.ok) throw new Error(result.error || 'Could not save the directive locally.');
          H.notify('Q Prime Directive saved on this device.', 'gold');
          buildQ(body);
        } else if (action === 'save-q-directive') {
          const result = Q.setQDirective(body.querySelector('#q-human-directive').value, event);
          if (!result.ok) throw new Error(result.error || 'Could not save Q’s human operating directive.');
          H.notify('Q human operating directive saved for Q and the agents.', 'gold');
          buildQ(body);
        } else if (action === 'save-hierarchy') {
          const result = Q.setHierarchy(body.querySelector('#q-hierarchy').value, event);
          if (!result.ok) throw new Error(result.error || 'Could not save the Bridge Crew Hierarchy Roster.');
          H.notify('Bridge Crew Hierarchy Roster saved for Q and the agents.', 'gold');
          buildQ(body);
        } else if (action === 'save-role-directive') {
          const role = button.dataset.qRole;
          const textarea = body.querySelector('[data-q-role-directive="' + role + '"]');
          const result = Q.setRoleDirective(role, textarea.value, event);
          if (!result.ok) throw new Error(result.error || 'Could not save that role directive.');
          H.notify(agentName(role) + ' role directive saved for Q and the agent.', 'gold');
          buildQ(body);
        } else if (action === 'add-command') {
          const result = Q.saveCommand('', body.querySelector('#q-new-command').value, body.querySelector('#q-new-response').value);
          if (!result.ok) throw new Error(result.error || 'Could not save that command response.');
          buildQ(body);
        } else if (action === 'save-command' || action === 'delete-command') {
          const row = button.closest('[data-q-command]');
          if (action === 'delete-command') Q.removeCommand(row.dataset.qCommand);
          else {
            const result = Q.saveCommand(row.dataset.qCommand, row.querySelector('[data-q-field="command"]').value, row.querySelector('[data-q-field="response"]').value);
            if (!result.ok) throw new Error(result.error || 'Could not save that command response.');
          }
          buildQ(body);
        } else if (action === 'open-agent') {
          if (!selectedNow || !App.selectAgent(selectedNow.agentId)) throw new Error('That agent’s conversation is unavailable.');
        } else if (action === 'send-reply' || action === 'send-match' || action === 'send-directive') {
          if (!selectedNow) throw new Error('Select an inbox item first.');
          const text = action === 'send-match' ? selectedNow.matchedResponse
            : action === 'send-directive' ? Q.directive()
            : body.querySelector('#q-reply').value.trim();
          if (!text) throw new Error(action === 'send-directive' ? 'Save the Prime Directive first.' : 'Enter a reply first.');
          if (!App.selectAgent(selectedNow.agentId)) throw new Error('That agent’s conversation is unavailable.');
          const sent = Chat.sendOrQueue(text);
          if (!sent.ok) throw new Error('Q could not send the response (' + sent.state + ').');
          const saved = Q.markReplied(selectedNow.id, text, sent.state);
          if (!saved.ok) throw new Error('The message was sent, but Q could not save its replied status.');
          H.notify((sent.state === 'queued' ? 'Reply queued for ' : 'Reply sent to ') + agentName(selectedNow.agentId) + '.', 'gold');
          buildQ(body);
        }
      } catch (error) {
        H.notify(error && error.message ? error.message : 'Q could not complete that action.', 'warn');
      }
    };
  }
  StationUI.registerWindow('q', 'Q · COMMUNICATIONS TERMINAL', buildQ, { console: true, className: 'q-terminal-win' });
})();
