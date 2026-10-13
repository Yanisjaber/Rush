/* src/features/sessions/session-modal-realise.js — contenu de la modale pour une séance RÉALISÉE
   (métriques, graphiques de streams, étapes). Déplacé tel quel depuis session-modal.js
   (aucun changement de comportement ; indentation d'origine conservée pour ne pas toucher
   aux espaces des gabarits HTML). */
import { appState } from '../../core/state.js';
import { getSportCategory } from '../dashboard/filters.js';
import { _injectRealisedStageTabs } from './stage-race.js';
import { compPrio, trophySvg } from '../../core/format.js';
import { compIsRealised } from '../competitions/competitions-page.js';
import { fmtMinToTime, parseTimeToMin } from '../competitions/comp-stages.js';
import { renderStreamsSection } from '../streams/streams-section.js';
import { escapeHtml } from '../../core/utils.js';

export function renderRealisedSession(ctx) {
  const { iso, source, date, dateStr, day, titleEl, metaEl, bodyEl } = ctx;
    if (!day) {
      titleEl.innerHTML = 'Aucune donnée';
      metaEl.textContent = dateStr;
      bodyEl.innerHTML = '<div class="modal-placeholder">Pas de données pour ce jour.</div>';
      document.getElementById('session-modal').classList.add('active');
      return;
    }
    // Activités RÉELLES de ce jour
    let acts = day.activities && day.activities.length ? day.activities : (day.sessionType ? [day] : []);
    // Activité FUSIONNÉE (triathlon = 1 ligne en base + étapes rattachées) :
    // on déplie les étapes dans la liste interne de la modale (streams/zones
    // consultables), la vue d'ensemble reste l'entrée et porte les infos du parent.
    const _mergedParent = acts.find(a => a._msLegs && a._msLegs.length) || null;
    if (_mergedParent) acts = acts.filter(a => a !== _mergedParent).concat(_mergedParent._msLegs);
    if (acts.length === 0) {
      titleEl.innerHTML = 'Pas de séance';
      metaEl.textContent = dateStr;
      bodyEl.innerHTML = '<div class="modal-placeholder">Aucune activité enregistrée ce jour-là.</div>';
    } else {
      let currentIdx = 0;
      // Groupe multisport (triathlon, brick...) : détecté une fois pour le jour
      let _msGroup = (acts.length > 1 && window.SportProfiles && window.SportProfiles.detectMultisport)
        ? window.SportProfiles.detectMultisport(acts) : null;
      // Parent fusionné : la vue d'ensemble doit exister même si la détection
      // échoue (transition hors norme…) -> groupe reconstruit depuis les étapes.
      if (_mergedParent && (!_msGroup || _msGroup.legs.length !== acts.length)) {
        const _legs2 = acts.map((a, i) => ({
          act: a, idx: i,
          cat: (typeof getSportCategory === 'function') ? getSportCategory(a.raw_type || a.sport) : 'autre',
          start: 0, dur: +a.duration || 0,
        }));
        _msGroup = {
          kind: (typeof getSportCategory === 'function' && getSportCategory(_mergedParent.raw_type || _mergedParent.sport) === 'triathlon') ? 'Triathlon' : 'Multisport',
          legs: _legs2, transitions: [],
          totals: {
            durMin: _mergedParent.duration || _legs2.reduce((s2, l2) => s2 + l2.dur, 0),
            tss: _mergedParent.tss || 0,
            kcal: _mergedParent.calories || 0,
          },
        };
      }
      // ===== VUE D'ENSEMBLE multisport : le triathlon est UNE activité =====
      // Même présentation que la fiche prévu : trophée + nom, totaux (durée/TSS/kcal),
      // une tuile par discipline, bandeau segments pour plonger dans chaque étape.
      function renderMsOverview() {
        currentIdx = -1;
        window.__modalActIdx = -1;
        const _triComp = window.__triCompForDate ? window.__triCompForDate(iso) : null;
        const _compAct = _mergedParent && _mergedParent.category === 'competition'
          ? _mergedParent
          : (acts.find(a => a.category === 'competition') || null);
        const isComp = !!_triComp || !!_compAct;
        const _pi = compPrio((_mergedParent && _mergedParent.priority) || (_triComp && _triComp.priority) || (_compAct && _compAct.priority));
        // Nom : activité fusionnée > compét liée > préfixe commun des étapes
        // (« Triathlon de Toulouse : Vélo » -> « Triathlon de Toulouse ») > type générique.
        let name = (_mergedParent && _mergedParent.name) || (_triComp && _triComp.name) || null;
        if (!name) {
          const _prefixes = _msGroup.legs.map(l => {
            const n2 = String(l.act.name || '');
            const cut = n2.search(/\s*[:\-–]\s+/);
            return cut > 0 ? n2.slice(0, cut).trim() : null;
          });
          if (_prefixes[0] && _prefixes.every(p => p === _prefixes[0])) name = _prefixes[0];
        }
        if (!name) name = _msGroup.kind;
        titleEl.innerHTML = isComp ? `${trophySvg(_pi.color, 18)} ${escapeHtml(name)}` : escapeHtml(name);
        const sportPill = `<span class="sport-pill" data-sport-cat="triathlon" style="margin-left:8px;vertical-align:middle;">${_msGroup.kind}</span>`;
        let startTime = '';
        const _st0 = _msGroup.legs[0].act.start_date_local;
        if (_st0) { const _m0 = String(_st0).match(/T(\d{2}):(\d{2})/); if (_m0) startTime = `${_m0[1]}h${_m0[2]}`; }
        metaEl.innerHTML = [dateStr, startTime].filter(Boolean).join(' · ') + sportPill;
        // Édition : la compétition liée s'édite via la modale compét ; sinon rien
        const _e = document.getElementById('modal-edit-btn');
        const _d = document.getElementById('modal-delete-btn');
        const _compId = (_mergedParent && _mergedParent.category === 'competition')
          ? String(_mergedParent.client_id || _mergedParent._sbId || '')
          : (_triComp ? String(_triComp.id) : (_compAct ? String(_compAct.client_id || _compAct._sbId || _compAct.id || '') : ''));
        if (isComp && _compId) {
          if (_e) { _e.hidden = false; _e.dataset.kind = 'comp'; _e.dataset.compId = _compId; }
          if (_d) { _d.hidden = false; _d.dataset.kind = 'comp'; _d.dataset.compId = _compId; }
        } else {
          if (_e) _e.hidden = true;
          if (_d) _d.hidden = true;
        }
        // ===== Proto A : chrono segmenté + cartes discipline =====
        const _COL = { natation: '#06b6d4', cyclisme: '#3b82f6', course: '#fc4c02' };
        const _LAB = { natation: 'Natation', cyclisme: 'Vélo', course: 'Course' };
        const _legSec = (a2) => Math.round(a2.moving_time || (a2.duration || 0) * 60);
        const _fmtChr = (sec) => {
          sec = Math.max(0, Math.round(sec));
          const h2 = Math.floor(sec / 3600), m2 = Math.floor((sec % 3600) / 60), s3 = sec % 60;
          return h2 > 0 ? `${h2}:${String(m2).padStart(2, '0')}:${String(s3).padStart(2, '0')}` : `${m2}:${String(s3).padStart(2, '0')}`;
        };
        const _trans = _msGroup.transitions || [];
        const _transSec = _trans.reduce((s2, t2) => s2 + t2, 0);
        const _legsSec = _msGroup.legs.reduce((s2, l2) => s2 + _legSec(l2.act), 0);
        const _totSec = (_mergedParent && _mergedParent.elapsed_time) ? _mergedParent.elapsed_time : (_legsSec + _transSec);
        const _distTot = +(_msGroup.legs.reduce((s2, l2) => s2 + (+l2.act.distance_km || 0), 0)).toFixed(1);
        // Sous-titre : transitions + distance + TSS + kcal
        const _subParts = [];
        if (_transSec > 0) _subParts.push(`dont ${_fmtChr(_transSec)} de transitions`);
        if (_distTot) _subParts.push(`${_distTot} km`);
        if (_msGroup.totals.tss) _subParts.push(`${Math.round(_msGroup.totals.tss)} TSS`);
        if (_msGroup.totals.kcal) _subParts.push(`${Math.round(_msGroup.totals.kcal)} kcal`);
        // Barre proportionnelle temps : étape / transition / étape...
        let _barSegs = '', _pctRow = '';
        _msGroup.legs.forEach((l2, i2) => {
          const sec = _legSec(l2.act);
          _barSegs += `<span style="flex:${Math.max(sec, 1)};background:${_COL[l2.cat] || '#9ca3af'}"></span>`;
          const pct = _totSec > 0 ? Math.round(sec / _totSec * 100) : 0;
          _pctRow += `<span>${_LAB[l2.cat] || (l2.cat.charAt(0).toUpperCase() + l2.cat.slice(1))} ${pct}%</span>`;
          if (i2 < _msGroup.legs.length - 1 && _trans[i2] != null) {
            _barSegs += `<span style="flex:${Math.max(_trans[i2], 1)};background:var(--border)"></span>`;
          }
        });
        // Métriques par discipline (sans la durée, affichée en gros sur la carte)
        const _legMeta = (l2) => {
          const a2 = l2.act, out = [];
          const durMin2 = (a2.duration || 0);
          if (l2.cat === 'natation') {
            if (a2.distance_km) out.push(Math.round(a2.distance_km * 1000) + ' m');
            if (a2.distance_km && durMin2) { const s2 = (durMin2 * 60) / (a2.distance_km * 10); out.push(`${Math.floor(s2 / 60)}:${String(Math.round(s2 % 60)).padStart(2, '0')} /100m`); }
          } else if (l2.cat === 'cyclisme') {
            if (a2.distance_km) out.push((Math.round(a2.distance_km * 10) / 10) + ' km');
            if (a2.avg_speed_kmh) out.push((Math.round(a2.avg_speed_kmh * 10) / 10) + ' km/h');
            if (a2.avg_watts) out.push(Math.round(a2.avg_watts) + ' W');
          } else {
            if (a2.distance_km) out.push((Math.round(a2.distance_km * 10) / 10) + ' km');
            if (a2.distance_km && durMin2) { const s2 = (durMin2 * 60) / a2.distance_km; out.push(`${Math.floor(s2 / 60)}:${String(Math.round(s2 % 60)).padStart(2, '0')} /km`); }
            if (a2.hr) out.push(Math.round(a2.hr) + ' bpm');
          }
          return out.join(' · ');
        };
        // Cartes disciplines avec les transitions CALÉES entre elles :
        // [Natation] ·T1· [Vélo] ·T2· [Course] — comme le déroulé réel.
        const _rowParts = [];
        _msGroup.legs.forEach((l2, i2) => {
          _rowParts.push(`
          <div class="tri-ov-card" data-leg-pos="${i2}" style="border-top-color:${_COL[l2.cat] || '#9ca3af'}" title="Voir l'analyse de cette discipline">
            <div class="tri-ov-card-lab">${_LAB[l2.cat] || l2.cat}</div>
            <div class="tri-ov-card-time">${_fmtChr(_legSec(l2.act))}</div>
            <div class="tri-ov-card-meta">${_legMeta(l2) || '&nbsp;'}</div>
          </div>`);
          if (i2 < _msGroup.legs.length - 1 && _trans[i2] != null) {
            _rowParts.push(`<div class="tri-ov-t" title="Transition ${i2 + 1}"><span>T${i2 + 1}</span><b>${_fmtChr(_trans[i2])}</b></div>`);
          }
        });
        const _cards = _rowParts.join('');
        // Comparaison au temps cible : UNIQUEMENT si une compét/séance PRÉVUE
        // portait un temps estimé (le target d'une compét réalisée est recalculé
        // depuis les temps réels -> objectif circulaire « −0 min », sans intérêt).
        const _plannedTri = (_triComp && !(typeof compIsRealised === 'function' && compIsRealised(_triComp))) ? _triComp : null;
        const _msComp2 = _plannedTri && _plannedTri.target ? { target: (typeof parseTimeToMin === 'function' ? parseTimeToMin(_plannedTri.target) : null) } : null;
        let _targetHTML = '';
        if (_msComp2 && _msComp2.target > 0) {
          const _dlt = Math.round(_totSec / 60) - _msComp2.target;
          const _ok = _dlt <= _msComp2.target * 0.02;
          const _c2 = _ok ? 'var(--accent)' : (_dlt <= _msComp2.target * 0.08 ? 'var(--warn)' : 'var(--danger)');
          _targetHTML = `<div class="tri-ov-target">Objectif ${fmtMinToTime(_msComp2.target)} → <b style="color:${_c2}">${_dlt > 0 ? '+' : '−'}${fmtMinToTime(Math.abs(_dlt)) || Math.abs(_dlt) + ' min'}</b></div>`;
        }
        const statsHTML = `<div class="modal-section tri-ov">
          <div class="tri-ov-head"><span class="tri-ov-chrono">${_fmtChr(_totSec)}</span><span class="tri-ov-sub">${_subParts.join(' · ')}</span></div>
          <div class="tri-ov-bar">${_barSegs}</div>
          <div class="tri-ov-pcts">${_pctRow}</div>
          ${_targetHTML}
          <div class="tri-ov-cards">${_cards}</div>
        </div>`;
        const groupHTML = '';
        // Fusion en base : proposer la fusion (jour multisport non fusionné) ou la
        // défusion (activité fusionnée -> suppression du parent, les étapes reviennent).
        const _canFuse = !_mergedParent && _msGroup.legs.length === acts.length
          && _msGroup.legs.every(l => l.act._sbId) && window.sb;
        const fuseHTML = _mergedParent
          ? `<div class="modal-section" style="display:flex;justify-content:flex-end;"><button type="button" class="ms-fuse-btn" id="ms-unfuse">Défusionner (retrouver les ${acts.length} activités)</button></div>`
          : (_canFuse ? `<div class="modal-section" style="display:flex;justify-content:flex-end;"><button type="button" class="ms-fuse-btn" id="ms-fuse">Fusionner en une seule activité</button></div>` : '');
        // Analyse détaillée intégrée : les cartes discipline servent d'onglets,
        // le graphique de streams de l'étape choisie s'affiche SOUS la fiche tri
        // (plus de navigation vers des sous-vues).
        const anaHTML = `<div class="modal-section"><div id="ms-ana-streams"></div></div>`;
        bodyEl.innerHTML = `${statsHTML}${groupHTML}${anaHTML}${fuseHTML}`;
        const _legStravaId = (a2) => {
          const raw = String(a2.id || a2.activityId || '').replace(/^s/, '').replace(/^i/, '');
          return /^\d+$/.test(raw) ? raw : null;
        };
        const _selectLeg = (li) => {
          const l2 = _msGroup.legs[li];
          if (!l2) return;
          bodyEl.querySelectorAll('.tri-ov-card').forEach(c2 => c2.classList.toggle('active', +c2.dataset.legPos === li));
          const labEl = bodyEl.querySelector('#ms-ana-lab');
          if (labEl) labEl.textContent = _LAB[l2.cat] || l2.cat;
          const wrap2 = bodyEl.querySelector('#ms-ana-streams');
          if (!wrap2) return;
          const sid = _legStravaId(l2.act);
          if (!sid) { wrap2.innerHTML = '<div class="modal-placeholder">Pas de données haute résolution pour cette étape.</div>'; return; }
          // Contexte global utilisé par la section streams (sport, activité, date)
          window.__lastActSbId = l2.act._sbId || null;
          window.__lastActDate = iso;
          window.__lastActSport = (typeof getSportCategory === 'function') ? getSportCategory(l2.act.raw_type || l2.act.sport) : null;
          window.__lastAct = l2.act;
          renderStreamsSection(wrap2, sid);
        };
        bodyEl.querySelectorAll('.tri-ov-card').forEach(c2 => {
          c2.addEventListener('click', () => _selectLeg(+c2.dataset.legPos));
        });
        // Par défaut : le vélo (watts) si présent, sinon la première étape
        let _defLeg = _msGroup.legs.findIndex(l2 => l2.cat === 'cyclisme');
        if (_defLeg < 0) _defLeg = 0;
        _selectLeg(_defLeg);
        const _fuseBtn = bodyEl.querySelector('#ms-fuse');
        if (_fuseBtn) _fuseBtn.addEventListener('click', async () => {
          _fuseBtn.disabled = true; _fuseBtn.textContent = 'Fusion…';
          try { await _doMergeMultisport({ name, isComp, _pi, _triComp }); }
          catch (err) { console.error('[fusion]', err); _fuseBtn.disabled = false; _fuseBtn.textContent = 'Réessayer la fusion'; }
        });
        const _unfuseBtn = bodyEl.querySelector('#ms-unfuse');
        if (_unfuseBtn) _unfuseBtn.addEventListener('click', async () => {
          const ok = await (window.appConfirm
            ? window.appConfirm({ title: 'Défusionner', message: `Supprimer « ${name} » et retrouver les activités séparées ?`, confirmLabel: 'Défusionner', danger: true })
            : Promise.resolve(window.confirm('Défusionner ?')));
          if (!ok) return;
          const { error } = await window.sb.from('activities').delete().eq('id', _mergedParent._sbId);
          if (error) { console.error('[défusion]', error); return; }
          location.reload();
        });
      }
      // Construit la ligne fusionnée en base + rattache les étapes (merged_into).
      async function _doMergeMultisport(ctx2) {
        const sb = window.sb;
        const legs = _msGroup.legs.map(l => l.act);
        // Pré-vol : la colonne merged_into doit exister (migration 2026-07-11),
        // sinon on créerait un doublon sans pouvoir rattacher les étapes.
        {
          const probe = await sb.from('activities').select('merged_into').limit(1);
          if (probe.error) {
            const msg = 'Fusion impossible : la migration « 2026-07-11_tri_fusion.sql » n\'est pas appliquée en base (colonne merged_into manquante). Colle son contenu dans le SQL Editor de Supabase puis réessaie.';
            if (window.appAlert) window.appAlert({ title: 'Migration requise', message: msg }); else alert(msg);
            throw new Error('colonne merged_into absente');
          }
        }
        const { data: { user } } = await sb.auth.getUser();
        if (!user) throw new Error('non connecté');
        const byCat = {};
        _msGroup.legs.forEach(l => { byCat[l.cat] = l.act; });
        const sw = byCat.natation || null, bk = byCat.cyclisme || null, rn = byCat.course || null;
        const _paceMinKm = (a) => { if (!a || !a.distance_km || !a.duration) return null; const s = (a.duration * 60) / a.distance_km; return Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0'); };
        const _pace100m = (a) => { if (!a || !a.distance_km || !a.duration) return null; const s = (a.duration * 60) / (a.distance_km * 10); return Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0'); };
        const tri = {};
        if (sw) { tri.swim = { min: +(sw.duration || 0), dist_m: sw.distance_km ? Math.round(sw.distance_km * 1000) : null, pace: _pace100m(sw) }; tri.swim_m = sw.distance_km ? Math.round(sw.distance_km * 1000) : null; }
        if (bk) { tri.bike = { min: +(bk.duration || 0), dist_km: bk.distance_km || null, speed: bk.avg_speed_kmh || null, dplus: bk.elevation_gain || null }; tri.bike_km = bk.distance_km || null; }
        if (rn) { tri.run = { min: +(rn.duration || 0), dist_km: rn.distance_km || null, pace: _paceMinKm(rn) }; tri.run_km = rn.distance_km || null; }
        if (_msGroup.transitions[0] != null) tri.t1_min = Math.round(_msGroup.transitions[0] / 6) / 10;
        if (_msGroup.transitions[1] != null) tri.t2_min = Math.round(_msGroup.transitions[1] / 6) / 10;
        const first = _msGroup.legs[0].act, lastL = _msGroup.legs[_msGroup.legs.length - 1].act;
        const movingSec = Math.round(legs.reduce((s2, a2) => s2 + (a2.moving_time || (a2.duration || 0) * 60), 0));
        const _t0 = new Date(String(first.start_date_local)).getTime();
        const _t1 = new Date(String(lastL.start_date_local)).getTime() + (lastL.moving_time || (lastL.duration || 0) * 60) * 1000;
        const _hrLegs = legs.filter(a2 => a2.hr && a2.duration);
        const row = {
          user_id: user.id,
          source: 'manual',
          client_id: 'msfusion-' + Date.now().toString(36),
          category: ctx2.isComp ? 'competition' : 'entrainement',
          priority: (ctx2._triComp && ctx2._triComp.priority) || null,
          name: ctx2.name,
          sport: 'Triathlon',
          start_date_local: first.start_date_local,
          moving_time: movingSec,
          elapsed_time: (isFinite(_t0) && isFinite(_t1) && _t1 > _t0) ? Math.round((_t1 - _t0) / 1000) : movingSec,
          distance_km: +(legs.reduce((s2, a2) => s2 + (+a2.distance_km || 0), 0).toFixed(2)) || null,
          total_elevation_gain: Math.round(legs.reduce((s2, a2) => s2 + (+a2.elevation_gain || 0), 0)) || null,
          tss: Math.round(_msGroup.totals.tss) || null,
          calories: Math.round(_msGroup.totals.kcal) || null,
          avg_heartrate: _hrLegs.length ? Math.round(_hrLegs.reduce((s2, a2) => s2 + a2.hr * a2.duration, 0) / _hrLegs.reduce((s2, a2) => s2 + a2.duration, 0)) : null,
          tri,
        };
        const { data: ins, error: insErr } = await sb.from('activities').insert(row).select('id').single();
        if (insErr) throw insErr;
        const { error: updErr } = await sb.from('activities').update({ merged_into: ins.id }).in('id', legs.map(a2 => a2._sbId));
        if (updErr) {
          // Rollback : ne JAMAIS laisser un parent sans étapes rattachées (doublon)
          try { await sb.from('activities').delete().eq('id', ins.id); } catch (e2) { /* ignore */ }
          throw updErr;
        }
        location.reload();
      }
      function renderModalActivity(idx) {
        if (idx === -1 && _msGroup) { renderMsOverview(); return; }
        currentIdx = idx;
        window.__modalActIdx = idx;
        const act = acts[idx];
        // Boutons d'action : seulement pour les activités manuelles (Strava est read-only)
        const _editBtn2 = document.getElementById('modal-edit-btn');
        const _delBtn2 = document.getElementById('modal-delete-btn');
        if (act.category === 'competition') {
          // Competition = activite avec category='competition' : edition via la modale competition.
          const _compId = String(act.client_id || act._sbId || act.id || '');
          if (_editBtn2) {
            _editBtn2.hidden = false;
            _editBtn2.dataset.kind = 'comp';
            _editBtn2.dataset.compId = _compId;
          }
          if (_delBtn2) {
            _delBtn2.hidden = false;
            _delBtn2.dataset.kind = 'comp';
            _delBtn2.dataset.compId = _compId;
          }
        } else if (act._manual) {
          const _lsId = act._manualId || act.client_id || act.id;
          // Entrainement manuel : TOUJOURS la modale complete (tous les champs + structure).
          // Si pas de copie locale, gpxEditTraining reconstruit la seance depuis la base.
          if (_editBtn2) {
            _editBtn2.hidden = false;
            _editBtn2.dataset.kind = 'training';
            _editBtn2.dataset.trainingId = _lsId;
            _editBtn2.dataset.trainingMode = 'realise';
          }
          if (_delBtn2) {
            _delBtn2.hidden = false;
            _delBtn2.dataset.kind = 'training';
            _delBtn2.dataset.trainingId = _lsId;
            _delBtn2.dataset.trainingMode = 'realise';
            _delBtn2.dataset.sbId = act._sbId || '';
          }
        } else {
          // Activité Strava : éditable via calque d'overrides (le crayon ouvre l'éditeur).
          // La poubelle masque l'activité.
          if (_editBtn2) {
            _editBtn2.hidden = false;
            _editBtn2.dataset.kind = 'strava-edit';
            _editBtn2.dataset.activityId = String(act.id || act.activityId || '');
            _editBtn2.dataset.iso = iso;
          }
          if (_delBtn2) {
            _delBtn2.hidden = false;
            _delBtn2.dataset.kind = 'strava';
            _delBtn2.dataset.activityId = String(act.id || act.activityId || '');
          }
        }
        const dur = act.duration || 0;
        const h = Math.floor(dur / 60);
        const m = (dur % 60).toString().padStart(2, '0');
        // Compétition : meme look que la fiche prevu (trophee + couleur de priorite).
        titleEl.innerHTML = (act.category === 'competition')
          ? `${trophySvg(compPrio(act.priority).color, 18)} ${escapeHtml(act.name || 'Compétition')}`
          : `${escapeHtml(act.name || act.sessionName || 'Séance')}`;
        // Nom de sport Strava exact + clé couleur pour la pill
        const sportLabel = window.activitySportLabel(act);
        const sportCat = window.activitySportColorKey ? window.activitySportColorKey(act) : 'autre';
        const sportPill = sportLabel
          ? `<span class="sport-pill" data-sport-cat="${sportCat}" style="margin-left:8px;vertical-align:middle;">${sportLabel}</span>`
          : '';
        // Heure de début depuis start_date_local (format ISO local)
        let startTime = '';
        if (act.start_date_local) {
          const m = act.start_date_local.match(/T(\d{2}):(\d{2})/);
          if (m) startTime = `${m[1]}h${m[2]}`;
        }
        const textParts = [dateStr];
        if (startTime) textParts.push(startTime);
        metaEl.innerHTML = textParts.join(' · ') + sportPill;

        // Enchaînement multisport détecté : bandeau groupé (segments cliquables)
        // à la place du switch générique ; sinon switch classique.
        const _msComp = _msGroup && window.__triCompForDate ? window.__triCompForDate(iso) : null;
        const groupHTML = _msGroup ? window.SportProfiles.renderMultisportHTML(_msGroup, idx, _msComp) : '';
        const _inGroup = _msGroup ? _msGroup.legs.some(l => l.idx === idx) : false;
        const switchHTML = (acts.length > 1 && !(groupHTML && _inGroup && acts.length === _msGroup.legs.length)) ? `
          <div class="modal-activity-switch">
            ${acts.map((a, i) => {
    const _ck = window.activitySportColorKey ? window.activitySportColorKey(a) : 'autre';
    return `<button class="${i === idx ? 'active' : ''}" data-i="${i}" title="${(a.name || 'Séance').replace(/"/g, '&quot;')}">
              <span class="mas-dot" data-c="${_ck}"></span>
              <span class="mas-name">${escapeHtml(a.name || 'Séance')}</span>
              ${a.tss ? `<span class="mas-tss">${a.tss}</span>` : ''}
            </button>`;
  }).join('')}
          </div>` : '';

        // Palettes vertes : 5 nuances pour FC, 7 pour Puissance (Coggan)
        const zoneColorsHR = ['#bbf7d0','#86efac','#4ade80','#16a34a','#14532d'];
        const zoneColorsPow = ['#dcfce7','#bbf7d0','#86efac','#4ade80','#22c55e','#15803d','#14532d'];
        // Plages
        const ftp = (window._athleteMeta && window._athleteMeta.ftp) || 250;
        const hrMax = (window._athleteMeta && window._athleteMeta.hr_max) || (act.max_hr ? Math.max(act.max_hr, 185) : 190);
        // 6 seuils pour 7 zones Coggan : 55/75/90/105/120/150% FTP
        const pZ = [
          Math.round(ftp*0.55), Math.round(ftp*0.75), Math.round(ftp*0.90),
          Math.round(ftp*1.05), Math.round(ftp*1.20), Math.round(ftp*1.50)
        ];
        // 4 seuils pour 5 zones FC : 60/70/80/90% HRmax
        const hZ = [Math.round(hrMax*0.60), Math.round(hrMax*0.70), Math.round(hrMax*0.80), Math.round(hrMax*0.90)];

        // Calcule la répartition % de temps dans chaque zone à partir d'un stream
        // N zones = thresholds.length + 1
        function computeZonesFromStream(values, thresholds) {
          if (!values || !values.length) return null;
          const counts = new Array(thresholds.length + 1).fill(0);
          let total = 0;
          for (const v of values) {
            if (v == null || isNaN(v) || v <= 0) continue;
            total++;
            let placed = false;
            for (let i = 0; i < thresholds.length; i++) {
              if (v < thresholds[i]) { counts[i]++; placed = true; break; }
            }
            if (!placed) counts[thresholds.length]++;
          }
          if (total === 0) return null;
          return counts.map(c => +(c / total * 100).toFixed(1));
        }

        // Récupère les streams en cache si dispo et calcule les zones cohérentes avec les labels
        let zonesHRComputed = null, zonesPowComputed = null;
        try {
          const aid = act.id || act.activityId || day.activityId;
          const cached = aid && window.STREAMS_CACHE ? window.STREAMS_CACHE[String(aid)] : null;
          if (cached && Array.isArray(cached)) {
            let hrData = null, wattsData = null;
            for (const s of cached) {
              if (s.type === 'heartrate') hrData = s.data;
              else if (s.type === 'watts') wattsData = s.data;
            }
            if (hrData) zonesHRComputed = computeZonesFromStream(hrData, hZ);
            if (wattsData) zonesPowComputed = computeZonesFromStream(wattsData, pZ);
          }
        } catch (e) { /* fallback sur les zones de l'API */ }
        // Labels affichés au centre du donut au hover (avec plage bpm/watts)
        const hrCenterLabels = [
          `Z1 (<${hZ[0]})`,
          `Z2 (${hZ[0]}-${hZ[1]})`,
          `Z3 (${hZ[1]}-${hZ[2]})`,
          `Z4 (${hZ[2]}-${hZ[3]})`,
          `Z5 (>${hZ[3]})`
        ];
        const powCenterLabels = [
          `Z1 (<${pZ[0]}w)`,
          `Z2 (${pZ[0]}-${pZ[1]}w)`,
          `Z3 (${pZ[1]}-${pZ[2]}w)`,
          `Z4 (${pZ[2]}-${pZ[3]}w)`,
          `Z5 (${pZ[3]}-${pZ[4]}w)`,
          `Z6 (${pZ[4]}-${pZ[5]}w)`,
          `Z7 (>${pZ[5]}w)`
        ];
        // Labels affichés dans la légende sous le donut (noms de zone)
        const hrNameLabels = ['Z1 récup','Z2 endurance','Z3 tempo','Z4 seuil','Z5 VO2max'];
        const powNameLabels = ['Z1 récup','Z2 endurance','Z3 tempo','Z4 seuil','Z5 VO2max','Z6 anaérobie','Z7 neuromusc.'];
        const zonesHR = zonesHRComputed || act.zones_hr || (act.zones && !act.zones_power ? act.zones : null);
        const zonesPow = zonesPowComputed || act.zones_power || null;
        const hasAnyZones = !!(zonesHR || zonesPow);
        const cols = (zonesHR && zonesPow) ? '1fr 1fr' : '1fr';
        const zonesHTML = hasAnyZones ? `
          <div class="modal-section">
            <div class="modal-section-title">Répartition par zones</div>
            <div style="display:grid;grid-template-columns:${cols};gap:20px;">
              ${zonesHR ? `<div style="text-align:center;min-width:0;">
                <div style="font-size:12px;color:var(--text-dim);margin-bottom:8px;">Zones FC</div>
                <div style="position:relative;height:180px;width:100%;"><canvas id="modal-zones-hr"></canvas></div>
                <div id="legend-zones-hr" style="display:flex;flex-wrap:wrap;justify-content:center;align-content:flex-start;gap:4px 10px;padding-top:8px;height:46px;font-size:10px;color:var(--text-dim);"></div>
              </div>` : ''}
              ${zonesPow ? `<div style="text-align:center;min-width:0;">
                <div style="font-size:12px;color:var(--text-dim);margin-bottom:8px;">Zones Puissance</div>
                <div style="position:relative;height:180px;width:100%;"><canvas id="modal-zones-power"></canvas></div>
                <div id="legend-zones-power" style="display:flex;flex-wrap:wrap;justify-content:center;align-content:flex-start;gap:4px 10px;padding-top:8px;height:46px;font-size:10px;color:var(--text-dim);"></div>
              </div>` : ''}
            </div>
          </div>` : '';

        // === Helpers pour bâtir les sections ===
        const card = (label, value, unit, sub) =>
          `<div class="modal-metric" style="text-align:center;">
             <div class="m-label">${label}</div>
             <div class="m-value">${value}${unit ? `<span style="font-size:14px;"> ${unit}</span>` : ''}</div>
             ${sub ? `<div class="m-sub">${sub}</div>` : ''}
           </div>`;
        const section = (title, cards) => {
          const filled = cards.filter(Boolean);
          if (filled.length === 0) return '';
          return `<div class="modal-section">
            <div class="modal-section-title">${title}</div>
            <div class="modal-metrics">${filled.join('')}</div>
          </div>`;
        };
        const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

        // --- 1. Synthèse : durée / distance / dénivelé / vitesse / TSS ---
        // Élapsed (h/m) depuis elapsed_time en secondes
        let elapsedSub = '';
        if (act.elapsed_time && act.elapsed_time > (act.moving_time || 0)) {
          const eh = Math.floor(act.elapsed_time / 3600);
          const em = Math.floor((act.elapsed_time % 3600) / 60).toString().padStart(2, '0');
          elapsedSub = `Élapsed ${eh}h${em}`;
        }
        const vMaxToShow = act.max_speed_smooth_kmh || act.max_speed_kmh;
        // Fallbacks de cles : Strava (distance_km / elevation_gain) ou saisie manuelle (km / dplus).
        const _distKm = act.distance_km || act.km;
        const _dplusM = act.elevation_gain || act.total_elevation_gain || act.dplus;
        // === Bloc stats piloté par le PROFIL DU SPORT (js/sport-profiles.js) ===
        // course -> allure /km, natation -> distance m + /100m, muscu -> pas de
        // distance/vitesse... Ajouter un sport = ajouter un profil dans le module.
        const heroCard = (hh2) =>
          `<div class="act-hero">`
          + `<span class="act-hero-ico" style="color:${hh2.color}">${hh2.svg}</span>`
          + `<div class="act-hero-tx"><div class="act-hero-val">${hh2.val}${hh2.unit ? `<span class="act-hero-unit"> ${hh2.unit}</span>` : ''}</div>`
          + `<div class="act-hero-lab">${hh2.lab}</div></div></div>`;
        const tile = (tt2) =>
          `<div class="act-tile" style="background:${tt2.color}17;--tile-c:${tt2.color}">`
          + `<div class="act-tile-lab">${tt2.lab}</div>`
          + `<div class="act-tile-val">${tt2.val}</div></div>`;
        // < 1h : minutes:secondes exactes (depuis moving_time) ; sinon h/min
        const _durSecTot = act.moving_time || act.elapsed_time || 0;
        // Même langage visuel que "1h46" : grands chiffres, unité en petit -> "44min02"
        const _durStr = dur < 60
          ? (_durSecTot > 0
            ? `${Math.floor(_durSecTot / 60)}<span style="font-size:13px">min</span>${String(Math.round(_durSecTot % 60)).padStart(2, '0')}`
            : `${Math.round(dur)}<span style="font-size:13px"> min</span>`)
          : `${h}<span style="font-size:13px">h</span>${m}`;
        const _spCtx = { durMin: dur, durStr: _durStr, elapsedSub, distKm: _distKm, dplusM: _dplusM };
        const _heroDefs = window.SportProfiles ? window.SportProfiles.heroes(act, _spCtx) : [];
        const _tileDefs = window.SportProfiles ? window.SportProfiles.tiles(act, _spCtx) : [];
        const _heroRow = _heroDefs.length ? `<div class="act-hero-row" data-n="${Math.min(_heroDefs.length, 4)}">${_heroDefs.slice(0, 4).map(heroCard).join('')}</div>` : '';
        const _n = _tileDefs.length;
        const _cols = _n <= 4 ? Math.max(1, _n) : Math.ceil(_n / 2);   // <=4 -> 1 rangee ; sinon 2 rangees equilibrees (desktop)
        const _tileGrid = _n ? `<div class="act-tile-grid" data-n="${_n}" style="--tile-cols:${_cols};--tile-tracks:${_cols * 2}">${_tileDefs.map(tile).join('')}</div>` : '';
        const statsHTML = (_heroRow || _tileGrid) ? `<div class="modal-section">${_heroRow}${_tileGrid}</div>` : '';

        // Id Strava : uniquement pour savoir si des streams existent (section graphique).
        // (le lien externe a été retiré : l'app n'affiche que SA base de données)
        const aId = act.id || act.activityId || day.activityId;
        const stravaId = aId ? String(aId).replace(/^s/, '').replace(/^i/, '') : '';
        const comparHTML = (typeof window.renderPrevuVsRealiseHTML === 'function') ? window.renderPrevuVsRealiseHTML(act, iso) : '';
        const _struct = act.structure;
        const _structDet = (Array.isArray(_struct) && _struct.length && typeof window.renderWorkoutDetailHTML === 'function') ? window.renderWorkoutDetailHTML(_struct, { sport: act.raw_type || act.sport }) : '';
        const profileHTML = (Array.isArray(_struct) && _struct.length && typeof window.renderWorkoutProfileHTML === 'function')
          ? `<div class="modal-section"><div class="modal-section-title">Profil de séance</div>${window.renderWorkoutProfileHTML(_struct, { sport: act.raw_type || act.sport })}${_structDet}</div>`
          : '';
        const _escNote = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
        const notesHTML = (act.notes && String(act.notes).trim())
          ? `<div class="modal-section"><div class="modal-section-title">Notes</div><div class="modal-info-box" style="white-space:pre-wrap;">${_escNote(act.notes)}</div></div>`
          : '';
        // Sections Strava : on n'affiche Graphique / Lien que s'il y a une vraie activite
        // Strava (sinon on n'affiche pas de cases vides).
        const _hasStrava = !!(stravaId && /^\d+$/.test(stravaId));
        const graphHTML = _hasStrava ? `<div class="modal-section"><div id="streams-section"></div></div>` : '';
        const lienHTML = '';
        bodyEl.innerHTML = `
          ${groupHTML}
          ${switchHTML}
          ${statsHTML}
          ${comparHTML}
          ${zonesHTML}
          ${profileHTML}
          ${notesHTML}
          ${graphHTML}
          ${lienHTML}
        `;
        try { window.__setupModalLinkSelect(act, iso); } catch (e) { /* ignore */ }
        // Wire switch buttons (avant le chargement async des streams)
        bodyEl.querySelectorAll('.modal-activity-switch button').forEach(btn => {
          btn.addEventListener('click', () => renderModalActivity(+btn.dataset.i));
        });
        // Segments du bandeau multisport -> bascule sur l'activité du segment
        bodyEl.querySelectorAll('.msg-seg').forEach(btn => {
          btn.addEventListener('click', () => renderModalActivity(+btn.dataset.legIdx));
        });

        // Camemberts des zones FC / Puissance — defer pour laisser le layout se calculer
        setTimeout(() => {
          // Durée totale (minutes) pour calculer le temps passé dans chaque zone
          const totalMin = act.duration || 0;
          const fmtTime = (totalSec) => {
            const h = Math.floor(totalSec / 3600);
            const m = Math.floor((totalSec % 3600) / 60);
            const s = Math.floor(totalSec % 60);
            if (h > 0) return `${h}h${m.toString().padStart(2,'0')}`;
            if (m > 0) return `${m}m${s.toString().padStart(2,'0')}`;
            return `${s}s`;
          };

          // Plugin texte central : %, temps passé, label centré (avec plage)
          const centerTextPlugin = {
            id: 'centerText',
            afterDraw(chart) {
              const idx = chart._hoveredIdx;
              if (idx == null) return;
              const ds = chart.data.datasets[0];
              const pct = ds.data[idx];
              // Si le chart a des labels custom pour le centre, les utilise, sinon fallback labels
              const label = (chart._centerLabels && chart._centerLabels[idx]) || chart.data.labels[idx];
              const timeSec = (pct / 100) * totalMin * 60;
              const { ctx, chartArea } = chart;
              const cx = (chartArea.left + chartArea.right) / 2;
              const cy = (chartArea.top + chartArea.bottom) / 2;
              ctx.save();
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              // % en gros
              ctx.fillStyle = ds.backgroundColor[idx];
              ctx.font = 'bold 22px ui-sans-serif, system-ui, sans-serif';
              ctx.fillText(pct.toFixed(1) + '%', cx, cy - 14);
              // Temps passé
              ctx.fillStyle = 'var(--text)'; ctx.fillStyle = '#e6e9ef';
              ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
              ctx.fillText(fmtTime(timeSec), cx, cy + 6);
              // Nom de zone (plus petit pour ne pas déborder)
              ctx.fillStyle = 'rgba(230,233,239,0.6)';
              ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
              ctx.fillText(label, cx, cy + 22);
              ctx.restore();
            }
          };

          const doughnutOpts = () => ({
            responsive: true, maintainAspectRatio: false,
            radius: '85%',
            plugins: {
              legend: { display: false }, // remplacée par légende HTML custom (hauteur fixe)
              tooltip: { enabled: false },
              verticalHoverLine: false
            },
            cutout: '62%',
            animation: { duration: 0 },
            interaction: { mode: 'nearest', intersect: true },
            transitions: {
              active: { animation: { duration: 200, easing: 'easeOutCubic' } }
            },
            onHover: (e, els, chart) => {
              const newIdx = (els && els.length) ? els[0].index : null;
              if (newIdx === chart._hoveredIdx) return;
              chart._hoveredIdx = newIdx;
              chart.setActiveElements(newIdx != null ? [{ datasetIndex: 0, index: newIdx }] : []);
              chart.update();
            }
          });
          // hoverOffset doit être sur le dataset en Chart.js v4
          const makeDataset = (data, colors) => ({
            data,
            backgroundColor: colors,
            borderWidth: 0,
            hoverOffset: 18,
            hoverBorderWidth: 0
          });
          // Helper : crée un donut + attache un listener mouseleave pour bien reset
          function makeDonut(canvasId, data, legendLabels, centerLabels, colors) {
            const cv = document.getElementById(canvasId);
            if (!cv) return null;
            const chart = new Chart(cv, {
              type: 'doughnut',
              data: { labels: legendLabels, datasets: [makeDataset(data, colors)] },
              options: doughnutOpts(),
              plugins: [centerTextPlugin]
            });
            chart._centerLabels = centerLabels;
            cv.addEventListener('mouseleave', () => {
              if (chart._hoveredIdx != null) {
                chart._hoveredIdx = null;
                chart.setActiveElements([]);
                chart.update();
              }
            });
            return chart;
          }
          // Helper : génère la légende HTML correspondante
          function fillLegend(elId, names, colors) {
            const el = document.getElementById(elId);
            if (!el) return;
            el.innerHTML = names.map((n, i) =>
              `<span style="display:inline-flex;align-items:center;gap:5px;white-space:nowrap;">
                <span style="width:9px;height:9px;background:${colors[i]};border-radius:2px;display:inline-block;"></span>${n}
              </span>`
            ).join('');
          }

          if (zonesHR) {
            const c = makeDonut('modal-zones-hr', zonesHR, hrNameLabels, hrCenterLabels, zoneColorsHR);
            if (c) appState._modalCharts.push(c);
            fillLegend('legend-zones-hr', hrNameLabels, zoneColorsHR);
          }
          if (zonesPow) {
            const is7 = zonesPow.length === 7;
            const powNames = is7 ? powNameLabels : ['Z1 récup','Z2 endurance','Z3 tempo','Z4 seuil','Z5 VO2max'];
            const powCenters = is7 ? powCenterLabels : [
              `Z1 (<${pZ[0]}w)`,
              `Z2 (${pZ[0]}-${pZ[1]}w)`,
              `Z3 (${pZ[1]}-${pZ[2]}w)`,
              `Z4 (${pZ[2]}-${pZ[3]}w)`,
              `Z5 (>${pZ[3]}w)`
            ];
            const powColors = is7 ? zoneColorsPow : zoneColorsHR;
            const c = makeDonut('modal-zones-power', zonesPow, powNames, powCenters, powColors);
            if (c) appState._modalCharts.push(c);
            fillLegend('legend-zones-power', powNames, powColors);
          }
        }, 0);
        // Lancer le chargement des streams en async (la modal est déjà visible)
        const _streamsEl = document.getElementById('streams-section');
        if (_streamsEl) {
          const streamId = act.id || act.activityId || day.activityId;
          window.__lastActSbId = act._sbId || null;
          window.__lastActDate = iso;
          window.__lastActSport = (typeof getSportCategory === 'function') ? getSportCategory(act.raw_type || act.sport) : null;
          window.__lastAct = act;
          if (streamId) renderStreamsSection(_streamsEl, streamId);
          else _streamsEl.innerHTML = '<div class="modal-placeholder">Pas d\'ID activité disponible pour cette séance.</div>';
        }
      }
      // Enchaînement multisport complet (triathlon…) : on ouvre sur la vue
      // d'ensemble (le tri est UNE activité), sauf si une étape précise est demandée.
      const _startIdx = (window.__openActIdx != null && window.__openActIdx < acts.length)
        ? window.__openActIdx
        : ((_mergedParent || (_msGroup && _msGroup.legs.length === acts.length)) ? -1 : 0);
      window.__openActIdx = null;
      renderModalActivity(_startIdx);
      // Sélecteur d'étapes si l'activité fait partie d'une course à étapes
      try { _injectRealisedStageTabs(iso, acts); } catch (e) { /* ignore */ }
    }
}
