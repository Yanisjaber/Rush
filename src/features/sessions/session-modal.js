/* src/features/sessions/session-modal.js — extrait de l'ancien app.js (découpage par fonctionnalité). */
import { appState } from '../../core/state.js';
import { loadTrainings } from '../training/train-modal.js';
import { getSportCategory, toIsoDate } from '../dashboard/filters.js';
import { _injectRealisedStageTabs, buildRealisedDay, extractGpxStats, renderGpxElevationChart, renderGpxLeafletMap } from '../gpx/gpx-render.js';
import { compPrio, fmtDur, trophySvg } from '../../core/format.js';
import { compIsRealised, loadCompetitionsExpanded } from '../competitions/competitions-page.js';
import { fmtMinToTime, parseTimeToMin } from '../competitions/comp-stages.js';
import { renderStreamsSection } from '../streams/streams-section.js';
import { dayPrevuIndex } from '../calendar/realise-calendar.js';
import { isRestDayForMode } from './session-actions.js';
import { PHASE_LABELS } from '../plan/week-plan.js';

export function openSessionModal(iso, source) {
  window.__currentModalIso = iso; window.__currentModalSource = source;
  { const _lw = document.getElementById('modal-link-wrap'); if (_lw) _lw.hidden = true; }
  // Reconstruire la date depuis l'iso (les jours futurs ne sont PAS dans data)
  const date = new Date(iso + 'T12:00:00');
  if (isNaN(date.getTime())) return;
  // Mobile : date compacte pour que l'heure + le sport tiennent sur la même ligne
  const dateStr = (window.innerWidth < 860)
    ? date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Lookup data uniquement pour le mode Réalisé (les jours futurs ne sont pas dedans).
  // En réalisé, on reconstruit le jour fusionné (manuelles + compétitions) comme la carte.
  const day = (source === 'realise')
    ? buildRealisedDay(iso)
    : (Array.isArray(appState.data) ? appState.data.find(d => toIsoDate(d.date) === iso) : null);

  const titleEl = document.getElementById('modal-title');
  const metaEl = document.getElementById('modal-meta');
  const bodyEl = document.getElementById('modal-body');

  // Cache les boutons d'action par défaut (seront ré-affichés au besoin)
  const _editBtn = document.getElementById('modal-edit-btn');
  const _delBtn = document.getElementById('modal-delete-btn');
  if (_editBtn) {
    _editBtn.hidden = true;
    // Reset des datasets (évite de garder l'état du précédent appel)
    delete _editBtn.dataset.compId;
    delete _editBtn.dataset.trainingId;
    delete _editBtn.dataset.trainingMode;
    delete _editBtn.dataset.templateIso;
    delete _editBtn.dataset.kind;
  }
  if (_delBtn) {
    _delBtn.hidden = true;
    delete _delBtn.dataset.compId;
    delete _delBtn.dataset.trainingId;
    delete _delBtn.dataset.trainingMode;
    delete _delBtn.dataset.activityId;
    delete _delBtn.dataset.sbId;
    delete _delBtn.dataset.kind;
  }

  if (source === 'realise') {
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
        titleEl.innerHTML = isComp ? `${trophySvg(_pi.color, 18)} ${name}` : name;
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
          ? `${trophySvg(compPrio(act.priority).color, 18)} ${act.name || 'Compétition'}`
          : `${act.name || act.sessionName || 'Séance'}`;
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
              <span class="mas-name">${a.name || 'Séance'}</span>
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
  } else {
    // ============= Source = 'prevu' =============
    const compsAll = loadCompetitionsExpanded().map(c => ({ ...c, dateObj: new Date(c.date + 'T12:00:00') }));
    const compsForToday = compsAll.filter(c => toIsoDate(c.dateObj) === iso);
    const manualTrainings = ((typeof loadTrainings === 'function') ? loadTrainings() : []).filter(t => !window.coachModeKeep || window.coachModeKeep(t.ia));
    const manualForToday = manualTrainings.filter(t => t.date === iso);

    // === Items affichables sur la day card (source de vérité pour la sélection clavier/flèches) ===
    // L'ordre DOIT correspondre à la day card : compsForToday + manualForToday
    const dayItems = [];
    compsForToday.forEach(c => dayItems.push({ kind: 'comp', data: c }));
    manualForToday.forEach(t => dayItems.push({ kind: 'manual', data: t }));

    // Item sélectionné par l'utilisateur via les flèches du calendrier
    let dayCurIdx = dayPrevuIndex[iso] || 0;
    if (dayCurIdx >= dayItems.length) dayCurIdx = 0;
    const selectedItem = dayItems[dayCurIdx] || null;

    // Build la liste d'items finale (avec enrichissement étapes si applicable)
    // - Si l'item sélectionné est une étape de stage race : enrichit avec TOUTES les étapes
    //   du parent pour permettre la navigation entre étapes via le switcher de la modal
    // - Sinon : la liste = items du jour
    const items = [];
    let curIdx = 0;
    if (selectedItem && selectedItem.kind === 'comp' && selectedItem.data.parentId) {
      const stageRaceItems = compsAll
        .filter(c => c.parentId === selectedItem.data.parentId)
        .sort((a, b) => (a.stageIdx || 0) - (b.stageIdx || 0));
      stageRaceItems.forEach(c => items.push({ kind: 'comp', data: c }));
      // Insère les autres items du jour (compés non-stage + manuels) qui ne sont pas déjà dedans
      dayItems.forEach(it => {
        if (it.kind !== 'comp' || it.data.parentId !== selectedItem.data.parentId) {
          items.push(it);
        }
      });
      // Trouve l'étape correspondant à l'item sélectionné
      const idx = items.findIndex(it => it.kind === 'comp' && it.data.id === selectedItem.data.id);
      curIdx = idx >= 0 ? idx : 0;
    } else if (dayItems.length > 0) {
      dayItems.forEach(it => items.push(it));
      curIdx = dayCurIdx;
    } else {
      // Rien d'explicite ce jour-là : pas de séance auto-générée (la planif IA
      // passe par le chat). On affiche un repos forcé éventuel, sinon « rien ».
      const _isForcedRest = (typeof isRestDayForMode === 'function') && isRestDayForMode(iso);
      const proposal = _isForcedRest
        ? { type: 'rest', name: 'Repos', dur: 0, tss: 0, why: 'Repos forcé (override utilisateur)' }
        : { type: 'libre', name: 'Aucune séance prévue', dur: 0, tss: 0, why: '' };
      items.push({ kind: 'template', data: proposal, phase: null });
      curIdx = 0;
    }
    if (curIdx >= items.length) curIdx = 0;

    function renderPrevuItem(idx) {
      curIdx = idx;
      const item = items[idx];
      // Mise à jour de la date affichée si l'item est une étape sur une autre date
      let effectiveDateStr = dateStr;
      if (item.kind === 'comp' && item.data.date && item.data.date !== iso) {
        const d2 = new Date(item.data.date + 'T12:00:00');
        if (!isNaN(d2.getTime())) {
          effectiveDateStr = d2.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        }
      }
      const switchHTML = items.length > 1 ? `
        <div class="modal-activity-switch">
          ${items.map((it, i) => {
            const label = it.kind === 'comp'
              ? (it.data.stageIdx !== undefined ? `Étape ${it.data.stageIdx + 1}` : it.data.name.split(' — ')[0])
              : (it.kind === 'manual' ? it.data.name : 'IA');
            return `<button class="${i === idx ? 'active' : ''}" data-i="${i}">${label}</button>`;
          }).join('')}
        </div>` : '';

      if (item.kind === 'comp') {
        renderCompModal(item.data, switchHTML, effectiveDateStr);
      } else if (item.kind === 'manual') {
        renderManualTrainingModal(item.data, switchHTML, effectiveDateStr);
      } else {
        renderTemplateModal(item.data, item.phase, switchHTML, effectiveDateStr);
      }
    }

    function renderCompModal(c, switchHTML, dateStrOverride) {
      const _dateStr = dateStrOverride || dateStr;
      const isStage = c.stageIdx !== undefined && c.totalStages;
      // Affiche les boutons "Modifier" et "Supprimer" pour cette compé
      const editBtn = document.getElementById('modal-edit-btn');
      const delBtn = document.getElementById('modal-delete-btn');
      if (editBtn) {
        editBtn.hidden = false;
        editBtn.dataset.kind = 'comp';
        editBtn.dataset.compId = c.parentId || c.id;
      }
      if (delBtn) {
        delBtn.hidden = false;
        delBtn.dataset.kind = 'comp';
        delBtn.dataset.compId = c.parentId || c.id;
      }
      const parentName = isStage ? c.name.replace(/ — Étape \d+$/, '') : c.name;
      const sportLabel = window.sportFr(c.sport || 'Ride');
      const sportCat = window.activitySportColorKey({ sport: c.sport }) || 'autre';
      const sportPill = `<span class="sport-pill" data-sport-cat="${sportCat}" style="margin-left:10px;vertical-align:middle;">${sportLabel}</span>`;

      // Title : juste le nom de la course (pas le numéro d'étape — déjà visible dans le switcher + section dédiée)
      titleEl.innerHTML = `${trophySvg(compPrio(c.priority).color, 18)} ${parentName}`;

      // Meta : date + heure + sport pill
      const timeStr = c.time ? ` · ${c.time.replace(':', 'h')}` : '';
      metaEl.innerHTML = `${_dateStr}${timeStr}${sportPill}`;

      // Parse target → minutes
      let raceMinutes = parseTimeToMin(c.target);

      // Calcule l'allure si km + target dispo (adapté au sport)
      let allure = null, allureLabel = 'Allure';
      if (c.km && raceMinutes) {
        const hours = raceMinutes / 60;
        const cyclingSports = ['Ride','VirtualRide','GravelRide','EBikeRide','MountainBikeRide','EMountainBikeRide','Velomobile','Handcycle'];
        const runSports = ['Run','TrailRun','VirtualRun'];
        const swimSports = ['Swim','OpenWaterSwim'];
        if (cyclingSports.includes(c.sport)) {
          allure = (c.km / hours).toFixed(1) + ' km/h';
        } else if (runSports.includes(c.sport)) {
          const minPerKm = raceMinutes / c.km;
          const mm = Math.floor(minPerKm);
          const ss = Math.round((minPerKm - mm) * 60);
          allure = `${mm}'${ss.toString().padStart(2,'0')}"/km`;
        } else if (swimSports.includes(c.sport)) {
          const minPer100m = (raceMinutes / c.km) / 10;
          const mm = Math.floor(minPer100m);
          const ss = Math.round((minPer100m - mm) * 60);
          allure = `${mm}'${ss.toString().padStart(2,'0')}"/100m`;
        } else {
          allure = (c.km / hours).toFixed(1) + ' km/h';
        }
      }

      // Si GPX présent : on override km / D+ avec les valeurs calculées depuis le fichier
      // (priorité au GPX → vérité terrain — sinon valeurs saisies manuellement)
      // Si nombre de tours défini, on multiplie km/D+/D- par le nombre de tours
      const lapsCount = parseInt(c.laps, 10) || 1;
      const gpxStats = c.gpxContent ? (typeof extractGpxStats === 'function' ? extractGpxStats(c.gpxContent, lapsCount) : null) : null;
      const effectiveKm = (gpxStats && gpxStats.km) || c.km;
      const effectiveDplus = (gpxStats && gpxStats.dplus) || c.dplus;
      // Recalcule l'allure si km vient du GPX
      if (gpxStats && gpxStats.km && raceMinutes) {
        const hours = raceMinutes / 60;
        const cyclingSports = ['Ride','VirtualRide','GravelRide','EBikeRide','MountainBikeRide','EMountainBikeRide','Velomobile','Handcycle'];
        const runSports = ['Run','TrailRun','VirtualRun'];
        const swimSports = ['Swim','OpenWaterSwim'];
        if (cyclingSports.includes(c.sport)) {
          allure = (gpxStats.km / hours).toFixed(1) + ' km/h';
        } else if (runSports.includes(c.sport)) {
          const minPerKm = raceMinutes / gpxStats.km;
          const mm = Math.floor(minPerKm);
          const ss = Math.round((minPerKm - mm) * 60);
          allure = `${mm}'${ss.toString().padStart(2,'0')}"/km`;
        } else if (swimSports.includes(c.sport)) {
          const minPer100m = (raceMinutes / gpxStats.km) / 10;
          const mm = Math.floor(minPer100m);
          const ss = Math.round((minPer100m - mm) * 60);
          allure = `${mm}'${ss.toString().padStart(2,'0')}"/100m`;
        } else {
          allure = (gpxStats.km / hours).toFixed(1) + ' km/h';
        }
      }

      // Ordre demandé : Temps cible → Distance → Dénivelé → Allure
      // Type d'épreuve en titre texte. Tours en complément.
      const cards = [];
      if (c.target != null && c.target !== '') cards.push({ label: 'Temps cible', value: fmtMinToTime(c.target), unit: '' });
      if (effectiveKm != null) cards.push({ label: 'Distance', value: effectiveKm, unit: 'km' });
      // Si GPX → D+ visible dans la barre stats du profil → on ne le montre pas en gros
      if (effectiveDplus != null && !gpxStats) cards.push({ label: 'Dénivelé +', value: effectiveDplus, unit: 'm' });
      if (allure) cards.push({ label: allureLabel, value: allure });
      if (c.laps != null) cards.push({ label: 'Tours', value: c.laps, unit: '' });
      if (c.tss != null && c.tss !== '') cards.push({ label: 'TSS estimé', value: c.tss, unit: '' });
      if (c.rpe != null && c.rpe !== '') cards.push({ label: 'RPE estimé', value: c.rpe, unit: '/10' });

      // Sections détaillées
      const sections = [];
      // Section GPX : si content présent → profil d'altitude + trace en grand
      if (c.gpxContent) {
        sections.push(`<div class="modal-section">
          <div class="modal-section-title">Profil d'altitude</div>
          <div class="gpx-stats-row" id="gpx-stats-row-prevu"></div>
          <div class="gpx-elev-wrap" id="gpx-elev-wrap-prevu" style="margin-bottom:14px;">
            <canvas id="gpx-elev-canvas-prevu"></canvas>
            <div class="gpx-elev-tooltip" id="gpx-elev-tooltip-prevu" style="display:none;"></div>
          </div>
          <div class="modal-section-title">Tracé du parcours</div>
          <div class="gpx-map-wrap"><div class="gpx-leaflet" id="gpx-leaflet-prevu"></div></div>
        </div>`);
      } else if (c.gpxName) {
        sections.push(`<div class="modal-section">
          <div class="modal-section-title">Trace GPX</div>
          <div class="modal-info-box">📍 <strong>${c.gpxName}</strong></div>
        </div>`);
      }
      if (c.notes) {
        sections.push(`<div class="modal-section">
          <div class="modal-section-title">Notes / Stratégie</div>
          <div class="modal-info-box" style="white-space:pre-wrap;">${escapeHtml(c.notes)}</div>
        </div>`);
      }
      // Section "Segments" : la liste des segments AJOUTÉS manuellement par l'utilisateur
      // (via drag-select + bouton "Ajouter segment")
      if (c.gpxContent) {
        sections.push(`<div class="modal-section gpx-segments-section">
          <div class="modal-section-title">Segments</div>
          <div class="climbs-list" id="gpx-segments-list"></div>
        </div>`);
        window._gpxClimbContent = c.gpxContent;
        window._gpxCurrentCompId = c.parentId || c.id;
      }

      // Titre "Type d'épreuve" au-dessus des cards
      const typeTitle = c.type
        ? `<div class="modal-section-title" style="margin-bottom:12px;font-size:18px;color:var(--text);text-transform:none;letter-spacing:0;">${c.type}</div>`
        : '';
      // Triathlon avec segments : timeline du déroulé de course à la place des tuiles génériques
      const triPlanHTML = (typeof getSportCategory === 'function' && getSportCategory(c.sport) === 'triathlon'
        && window.SportProfiles && window.SportProfiles.renderTriPlanHTML) ? window.SportProfiles.renderTriPlanHTML(c) : '';
      const mkCards = (arr) => `<div class="modal-metrics">
          ${arr.map(card => `<div class="modal-metric${card.accent ? ' accent' : ''}"><div class="m-label">${card.label}</div><div class="m-value" style="${card.isText ? 'font-size:16px;' : ''}">${card.value}${card.unit ? `<span style="font-size:13px;font-weight:500;margin-left:2px;">${card.unit}</span>` : ''}</div></div>`).join('')}
        </div>`;
      // Timeline tri : les tuiles generiques disparaissent, mais TSS/RPE restent affiches dessous
      const chargeCards = cards.filter(cd => cd.label === 'TSS estimé' || cd.label === 'RPE estimé');
      bodyEl.innerHTML = `
        ${switchHTML}
        ${typeTitle}
        ${triPlanHTML ? (triPlanHTML + (chargeCards.length ? mkCards(chargeCards) : '')) : mkCards(cards)}
        ${sections.join('')}
      `;
      wireSwitchButtons();
      // Rendu GPX si présent : profil altitude Chart.js + tracé Leaflet
      if (c.gpxContent) {
        renderGpxElevationChart(c.gpxContent, 'gpx-elev-canvas-prevu', lapsCount);
        renderGpxLeafletMap(c.gpxContent, 'gpx-leaflet-prevu');
        wireClimbsList();
      }
    }

    // === SEGMENTS UTILISATEUR (exposés sur window pour le bouton du chart) ===
    window._gpxSegKey = (compId) => `coach_ia_gpx_segments_${compId || 'global'}`;
    window.gpxLoadSegments = (compId) => {
      try {
        const raw = localStorage.getItem(window._gpxSegKey(compId));
        if (!raw) return [];
        return JSON.parse(raw);
      } catch (e) { return []; }
    };
    window.gpxSaveSegments = (compId, arr) => {
      localStorage.setItem(window._gpxSegKey(compId), JSON.stringify(arr));
    };
    window.gpxRenderSegmentsList = () => {
      const list = document.getElementById('gpx-segments-list');
      if (!list) return;
      const compId = window._gpxCurrentCompId;
      const segs = window.gpxLoadSegments(compId);
      if (segs.length === 0) {
        list.innerHTML = `<div class="comp-empty" style="padding:14px;">Sélectionne une portion du profil pour créer un segment.</div>`;
        return;
      }
      list.innerHTML = segs.map((s, i) => {
        const cat = s.gain >= 1000 ? 'HC' : s.gain >= 600 ? '1' : s.gain >= 300 ? '2' : s.gain >= 150 ? '3' : '4';
        return `<div class="climb-item" data-seg-idx="${i}">
          <div class="climb-row">
            <div class="climb-cat cat-${cat}">${cat}</div>
            <div class="climb-info">
              <div class="climb-range">${s.name || `Segment ${i + 1}`}</div>
              <div class="climb-meta">km ${s.startKm.toFixed(1)} → ${s.endKm.toFixed(1)} · ${s.distKm.toFixed(2)} km · D+ ${Math.round(s.gain)} m · ${s.avgSlope.toFixed(1)}% moy. · ${s.maxSlope.toFixed(1)}% max</div>
            </div>
            <button class="seg-del-btn" data-seg-del="${i}" title="Supprimer">×</button>
            <div class="climb-chevron">▼</div>
          </div>
          <div class="climb-detail" hidden></div>
        </div>`;
      }).join('');
    };
    window.gpxAddCurrentSelectionAsSegment = async () => {
      const sel = window._gpxCurrentSelectionStats;
      if (!sel) {
        await appAlert({
          title: 'Aucune sélection',
          message: 'Sélectionne d\'abord une portion du profil d\'altitude (glisse sur le graphique).',
        });
        return;
      }
      const compId = window._gpxCurrentCompId;
      const segs = window.gpxLoadSegments(compId);
      const idx = segs.length + 1;
      const name = await appPrompt({
        title: 'Nouveau segment',
        message: 'Donne un nom à ce segment du parcours.',
        defaultValue: `Segment ${idx}`,
        placeholder: `Segment ${idx}`,
        okLabel: 'Ajouter',
      });
      if (name === null) return;
      segs.push({
        startKm: sel.kmMin,
        endKm: sel.kmMax,
        distKm: sel.distKm,
        gain: sel.gain,
        loss: sel.loss,
        avgSlope: sel.avgSlope,
        maxSlope: sel.maxSlope,
        minSlope: sel.minSlope,
        name: (name && name.trim()) || `Segment ${idx}`,
        createdAt: new Date().toISOString(),
      });
      window.gpxSaveSegments(compId, segs);
      window.gpxRenderSegmentsList();
    };
    // Aliases pour compat interne (utilisés par wireClimbsList plus bas)
    const loadSegments = window.gpxLoadSegments;
    const saveSegments = window.gpxSaveSegments;
    const renderSegmentsList = window.gpxRenderSegmentsList;

    function wireClimbsList() {
      const list = document.getElementById('gpx-segments-list');
      if (!list) return;
      renderSegmentsList();
      list.addEventListener('click', (e) => {
        // Bouton suppression
        const delBtn = e.target.closest('.seg-del-btn');
        if (delBtn) {
          e.stopPropagation();
          const i = +delBtn.dataset.segDel;
          const compId = window._gpxCurrentCompId;
          const segs = loadSegments(compId);
          segs.splice(i, 1);
          saveSegments(compId, segs);
          renderSegmentsList();
          return;
        }
        const item = e.target.closest('.climb-item');
        if (!item) return;
        const idx = +item.dataset.segIdx;
        const compId = window._gpxCurrentCompId;
        const segs = loadSegments(compId);
        const gpx = window._gpxClimbContent;
        if (!segs[idx] || !gpx) return;
        const detail = item.querySelector('.climb-detail');
        const chevron = item.querySelector('.climb-chevron');
        const isOpen = !detail.hidden;
        list.querySelectorAll('.climb-item').forEach(it => {
          const d = it.querySelector('.climb-detail');
          const c = it.querySelector('.climb-chevron');
          if (d && d !== detail) { d.hidden = true; d.innerHTML = ''; }
          if (c) c.style.transform = '';
          it.classList.remove('expanded');
        });
        if (isOpen) {
          detail.hidden = true;
          detail.innerHTML = '';
          chevron.style.transform = '';
          item.classList.remove('expanded');
        } else {
          detail.innerHTML = renderClimbDetail(segs[idx], gpx);
          detail.hidden = false;
          chevron.style.transform = 'rotate(180deg)';
          item.classList.add('expanded');
        }
      });
    }

    // Rendu HTML du détail d'une bosse : profil découpé en segments coloréés par pente
    function renderClimbDetail(climb, gpxContent) {
      // Re-parse et filtre la série dans [startKm, endKm]
      const parser = new DOMParser();
      const doc = parser.parseFromString(gpxContent, 'application/xml');
      const trkpts = doc.getElementsByTagName('trkpt');
      const pts = trkpts.length ? trkpts : (doc.getElementsByTagName('rtept').length ? doc.getElementsByTagName('rtept') : []);
      function _d(lat1, lon1, lat2, lon2) {
        const R = 6371, toRad = d => d * Math.PI / 180;
        const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
        return 2 * R * Math.asin(Math.sqrt(a));
      }
      let cumKm = 0, prevLat = null, prevLon = null;
      const fullSeries = [];
      for (let i = 0; i < pts.length; i++) {
        const lat = parseFloat(pts[i].getAttribute('lat'));
        const lon = parseFloat(pts[i].getAttribute('lon'));
        if (isNaN(lat) || isNaN(lon)) continue;
        if (prevLat !== null) cumKm += _d(prevLat, prevLon, lat, lon);
        prevLat = lat; prevLon = lon;
        const eleEl = pts[i].getElementsByTagName('ele')[0];
        const ele = eleEl ? parseFloat(eleEl.textContent) : NaN;
        if (!isNaN(ele)) fullSeries.push({ km: cumKm, ele });
      }
      const series = fullSeries.filter(p => p.km >= climb.startKm && p.km <= climb.endKm);
      if (series.length < 2) return '<div class="modal-placeholder">Pas assez de points</div>';

      // Découpage en segments de ~100m
      const segLen = 0.1; // km
      const segments = [];
      let segStart = series[0];
      for (let i = 1; i < series.length; i++) {
        const p = series[i];
        if (p.km - segStart.km >= segLen || i === series.length - 1) {
          const dx = (p.km - segStart.km) * 1000;
          const dy = p.ele - segStart.ele;
          const slope = dx > 0 ? (dy / dx) * 100 : 0;
          segments.push({
            startKm: segStart.km, endKm: p.km,
            startEle: segStart.ele, endEle: p.ele,
            slope,
            dist: p.km - segStart.km,
            gain: Math.max(0, dy),
          });
          segStart = p;
        }
      }

      // Couleur selon pente
      function slopeColor(s) {
        if (s < 3) return '#4ade80';
        if (s < 6) return '#fbbf24';
        if (s < 9) return '#f97316';
        if (s < 12) return '#ef4444';
        return '#b91c1c';
      }

      // SVG du profil découpé
      const W = 900, H = 240, padL = 30, padR = 16, padT = 16, padB = 30;
      const dw = W - padL - padR, dh = H - padT - padB;
      const totalSegKm = climb.endKm - climb.startKm;
      const minE = Math.min(...series.map(p => p.ele));
      const maxE = Math.max(...series.map(p => p.ele));
      const rng = Math.max(maxE - minE, 5);

      // Dessine chaque segment comme un polygone coloré
      const segmentsSvg = segments.map(s => {
        const x1 = padL + ((s.startKm - climb.startKm) / totalSegKm) * dw;
        const x2 = padL + ((s.endKm - climb.startKm) / totalSegKm) * dw;
        const y1 = padT + dh - ((s.startEle - minE) / rng) * dh;
        const y2 = padT + dh - ((s.endEle - minE) / rng) * dh;
        const baseY = padT + dh;
        const color = slopeColor(s.slope);
        return `<polygon points="${x1},${baseY} ${x1},${y1} ${x2},${y2} ${x2},${baseY}" fill="${color}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5">
          <title>km ${s.startKm.toFixed(2)} → ${s.endKm.toFixed(2)} · ${s.slope.toFixed(1)}% · +${s.gain.toFixed(0)}m</title>
        </polygon>`;
      }).join('');

      // Ticks Y (altitude)
      const yTicks = [];
      for (let i = 0; i <= 3; i++) {
        const e = minE + (rng * (1 - i / 3));
        const y = padT + (dh * i / 3);
        yTicks.push(`<text x="${padL - 4}" y="${y + 4}" text-anchor="end" fill="#64748b" font-size="10">${Math.round(e)}m</text>`);
      }
      // Ticks X (km depuis début bosse)
      const xTicks = [];
      const nTicks = Math.min(5, Math.max(2, Math.round(totalSegKm)));
      for (let i = 0; i <= nTicks; i++) {
        const km = climb.startKm + (totalSegKm * i / nTicks);
        const x = padL + (dw * i / nTicks);
        xTicks.push(`<text x="${x}" y="${H - 10}" text-anchor="middle" fill="#64748b" font-size="10">${km.toFixed(1)}</text>`);
      }

      // Légende des couleurs de pente
      const legend = `
        <div class="climb-legend">
          <span><span class="dot" style="background:#4ade80;"></span>&lt; 3%</span>
          <span><span class="dot" style="background:#fbbf24;"></span>3-6%</span>
          <span><span class="dot" style="background:#f97316;"></span>6-9%</span>
          <span><span class="dot" style="background:#ef4444;"></span>9-12%</span>
          <span><span class="dot" style="background:#b91c1c;"></span>≥ 12%</span>
        </div>
      `;

      // Liste des segments raides (>= 6%)
      const steepSegs = segments.filter(s => s.slope >= 6);
      const steepList = steepSegs.length ? `
        <div class="climb-steep-list">
          <div class="climb-steep-title">Sections les plus raides</div>
          ${steepSegs.map(s => `
            <div class="climb-steep-item">
              <span class="dot" style="background:${slopeColor(s.slope)};"></span>
              <span class="ss-range">km ${s.startKm.toFixed(2)} → ${s.endKm.toFixed(2)}</span>
              <span class="ss-slope">${s.slope.toFixed(1)}%</span>
              <span class="ss-gain">+${s.gain.toFixed(0)}m</span>
            </div>
          `).join('')}
        </div>
      ` : '';

      return `
        <div class="climb-detail-inner">
          <svg class="climb-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
            <rect x="0" y="0" width="${W}" height="${H}" fill="rgba(0,0,0,0.2)" rx="6"/>
            ${segmentsSvg}
            ${yTicks.join('')}
            ${xTicks.join('')}
          </svg>
          ${legend}
          ${steepList}
        </div>
      `;
    }

    function renderManualTrainingModal(t, switchHTML, dateStrOverride) {
      const _dateStr = dateStrOverride || dateStr;
      // Affiche les boutons Modifier + Supprimer pour cet entraînement manuel prévu
      const editBtn = document.getElementById('modal-edit-btn');
      const delBtn = document.getElementById('modal-delete-btn');
      if (editBtn) {
        editBtn.hidden = false;
        editBtn.dataset.kind = 'training';
        editBtn.dataset.trainingId = t.id;
        editBtn.dataset.trainingMode = 'prevu';
      }
      if (delBtn) {
        delBtn.hidden = false;
        delBtn.dataset.kind = 'training';
        delBtn.dataset.trainingId = t.id;
        delBtn.dataset.trainingMode = 'prevu';
      }
      const sportLabel = window.sportFr(t.sport || 'Ride');
      const sportCat = window.activitySportColorKey({ sport: t.sport }) || 'autre';
      const sportPill = `<span class="sport-pill" data-sport-cat="${sportCat}" style="margin-left:8px;vertical-align:middle;">${sportLabel}</span>`;
      titleEl.textContent = t.name;
      // Heure (comme en realise) si la seance en a une ; sinon juste la date.
      let _timeStr = '';
      if (t.time) _timeStr = ' · ' + String(t.time).replace(':', 'h');
      else if (t.start_date_local) {
        const _mt = String(t.start_date_local).match(/T(\d{2}):(\d{2})/);
        if (_mt) _timeStr = ` · ${_mt[1]}h${_mt[2]}`;
      }
      metaEl.innerHTML = `${_dateStr}${_timeStr}${sportPill}`;
      const dur = t.duration || 0;
      const _S = window.__statSvg || {};
      const _heroes = [];
      if (dur) _heroes.push({ svg: _S.clock, val: (dur < 60 ? Math.round(dur) + '<span style="font-size:13px"> min</span>' : (Math.floor(dur / 60) + '<span style="font-size:13px">h</span>' + String(Math.round(dur % 60)).padStart(2, '0'))), unit: '', lab: 'Durée prévue', color: '#60a5fa' });
      if (t.km) { const _dp = window.fmtDist(t.km, t.sport).split(' '); _heroes.push({ svg: _S.route, val: _dp[0], unit: _dp[1], lab: 'Distance prévue', color: '#22d3ee' }); }
      // TOUT vient des valeurs STOCKÉES (dérivées de la structure au save).
      // Fallback unique pour les anciennes séances jamais re-sauvées : summary().
      let _est = { w: t.estWatts, bpm: t.estBpm, speedKmh: t.estSpeed, kj: t.estKj, ifr: t.estIf };
      if (_est.w == null && _est.bpm == null && _est.speedKmh == null && _est.kj == null
          && Array.isArray(t.structure) && t.structure.length && window.StructEd && window.StructEd.summary) {
        try { _est = window.StructEd.summary(t.structure, t.sport || 'Ride'); } catch (e) { /* ignore */ }
      }
      // Allure/vitesse prévue : est_speed stockée convertie selon le sport, sinon km+durée
      let _rp = _est.speedKmh ? window.speedToRate(_est.speedKmh, t.sport) : null;
      if (!_rp && t.km && dur) _rp = window.fmtRate(t.km, dur, t.sport);
      if (_rp) { const _ri = _rp.indexOf(' '); _heroes.push({ svg: _S.speed, val: _rp.slice(0, _ri), unit: _rp.slice(_ri + 1), lab: window.rateLabel(t.sport) + ' prévue', color: '#34d399' }); }
      if (t.dplus) _heroes.push({ svg: _S.mtn, val: Math.round(t.dplus), unit: 'm D+', lab: 'Dénivelé prévu', color: '#84cc16' });
      if (_heroes.length < 3 && t.tss) _heroes.push({ svg: _S.bolt, val: t.tss, unit: '', lab: 'TSS estimé', color: '#fbbf24' });
      const _tiles = [];
      if (t.tss && _heroes.every(function (h) { return h.lab !== 'TSS estimé'; })) _tiles.push({ lab: 'TSS estimé', val: '' + t.tss, color: '#fbbf24' });
      if (t.rpe != null && t.rpe !== '') _tiles.push({ lab: 'RPE estimé', val: t.rpe + '/10', color: '#f59e0b' });
      if (_est.w != null) _tiles.push({ lab: 'Watts moy estimés', val: _est.w + ' W', color: '#a5b4fc' });
      if (_est.bpm != null) _tiles.push({ lab: 'FC moy estimée', val: _est.bpm + ' bpm', color: '#a5b4fc' });
      if (_est.kj != null) _tiles.push({ lab: 'Énergie estimée', val: Math.round(_est.kj) + ' kJ', color: '#9ca3af' });
      if (_est.ifr != null && _est.ifr > 0) _tiles.push({ lab: 'IF estimé', val: (+_est.ifr).toFixed(2), color: '#f97316' });
      const statsHTML = window.renderStatsBlockHTML(_heroes, _tiles);

      const sections = [];
      if (Array.isArray(t.structure) && t.structure.length && typeof window.renderWorkoutProfileHTML === 'function') {
        const _det = (typeof window.renderWorkoutDetailHTML === 'function') ? window.renderWorkoutDetailHTML(t.structure, { sport: t.sport }) : '';
        sections.push(`<div class="modal-section"><div class="modal-section-title">Profil de séance</div>${window.renderWorkoutProfileHTML(t.structure, { sport: t.sport })}${_det}</div>`);
      }
      if (t.notes) {
        sections.push(`<div class="modal-section">
          <div class="modal-section-title">Notes / Structure</div>
          <div class="modal-info-box" style="white-space:pre-wrap;">${escapeHtml(t.notes)}</div>
        </div>`);
      }
      bodyEl.innerHTML = `
        ${switchHTML}
        ${statsHTML}
        ${sections.join('')}
      `;
      wireSwitchButtons();
    }

    function renderTemplateModal(proposal, phase, switchHTML, dateStrOverride) {
      const _dateStr = dateStrOverride || dateStr;
      const isRest = proposal.type === 'rest' || (proposal.dur === 0 && proposal.tss === 0);
      const editBtn = document.getElementById('modal-edit-btn');
      const delBtn = document.getElementById('modal-delete-btn');

      // === Jour de repos : modal ultra-épurée ===
      if (isRest) {
        // ⋯ "personnaliser" reste utile (ajouter une séance ce jour-là)
        // 🗑️ caché (déjà repos, rien à supprimer)
        if (editBtn) {
          editBtn.hidden = false;
          editBtn.dataset.kind = 'template';
          editBtn.dataset.templateIso = iso;
          editBtn.dataset.templateData = JSON.stringify({
            name: 'Nouvelle séance',
            type: 'endurance',
            duration: 60,
            tss: 50,
            sport: 'Ride',
            notes: ''
          });
        }
        if (delBtn) delBtn.hidden = true;
        titleEl.textContent = 'Jour de repos';
        metaEl.textContent = _dateStr;
        bodyEl.innerHTML = `
          ${switchHTML}
          <div class="modal-rest-state">
            <div class="modal-rest-icon">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            </div>
            <div class="modal-rest-text">Récupération complète.</div>
            <div class="modal-rest-hint">Utilise <strong>⋯</strong> pour ajouter une séance ce jour-là.</div>
          </div>
        `;
        wireSwitchButtons();
        return;
      }

      // === Suggestion IA normale ===
      if (editBtn) {
        editBtn.hidden = false;
        editBtn.dataset.kind = 'template';
        editBtn.dataset.templateIso = iso;
        editBtn.dataset.templateData = JSON.stringify({
          name: proposal.name || 'Séance IA',
          type: proposal.type || 'endurance',
          duration: proposal.dur || 0,
          tss: proposal.tss || 0,
          sport: proposal.sport || 'Ride',
          notes: proposal.why || ''
        });
      }
      if (delBtn) {
        delBtn.hidden = false;
        delBtn.dataset.kind = 'template';
        delBtn.dataset.templateIso = iso;
      }
      const dur = proposal.dur || 0;
      const h = Math.floor(dur / 60), mm = (dur % 60).toString().padStart(2, '0');
      titleEl.innerHTML = `${proposal.name}`;
      metaEl.textContent = `${_dateStr} · ${fmtDur(dur)} · ${proposal.tss || 0} TSS prévus · phase ${PHASE_LABELS[phase] || phase}`;
      bodyEl.innerHTML = `
        ${switchHTML}
        <div class="modal-metrics">
          <div class="modal-metric"><div class="m-label">Durée cible</div><div class="m-value">${dur < 60 ? `${Math.round(dur)}<span style="font-size:14px;"> min</span>` : `${h}<span style="font-size:14px;">h</span>${mm}`}</div></div>
          <div class="modal-metric"><div class="m-label">TSS cible</div><div class="m-value">${proposal.tss || 0}</div></div>
          <div class="modal-metric"><div class="m-label">Phase</div><div class="m-value" style="font-size:15px;">${PHASE_LABELS[phase] || '—'}</div></div>
        </div>
        <div class="modal-section">
          <div class="modal-section-title">Pourquoi cette séance</div>
          <div class="modal-info-box">${proposal.why || '—'}</div>
        </div>
      `;
      wireSwitchButtons();
    }

    function wireSwitchButtons() {
      bodyEl.querySelectorAll('.modal-activity-switch button').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = +btn.dataset.i;
          dayPrevuIndex[iso] = i;
          renderPrevuItem(i);
        });
      });
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    renderPrevuItem(curIdx);
  }
  document.getElementById('session-modal').classList.add('active');
}


export function closeSessionModal() {
  document.getElementById('session-modal').classList.remove('active');
}

export function bootSessionModal() {

// ============================================================
// Comparaison PRÉVU vs RÉALISÉ (affichée dans la modale du réalisé).
// Rapproche une activité réalisée avec une séance prévue : même jour, même sport,
// et (si plusieurs réalisées le même jour) durée la plus proche (appariement greedy).
// ============================================================
// Rapprochement PREVU<->REALISE : renvoie {planned:[prevus du jour], matched:prevu|null}
// et persiste le lien auto la 1re fois (meme jour + sport + duree la plus proche, greedy).
window.__plannedMatch = function (act, iso) {
  var empty = { planned: [], matched: null };
  try {
    if (!act || act.category === 'competition') return empty;
    var planned = ((typeof loadTrainings === 'function') ? loadTrainings() : [])
      .filter(function (t) { return !window.coachModeKeep || window.coachModeKeep(t.ia); })
      .filter(function (t) { return t.date === iso; });
    var catOf = function (x) { return (typeof getSportCategory === 'function') ? getSportCategory(x) : x; };
    var actCat = catOf(act.raw_type || act.sport);
    var link = act.planned_id;
    var matched = null;
    if (link && link !== 'none') {
      matched = planned.find(function (p) { return String(p._sbId) === String(link); });
      if (!matched) link = null;
    }
    if (!matched && link !== 'none') {
      var cands = planned.filter(function (p) { return catOf(p.sport) === actCat; });
      if (cands.length) {
        var dayObj = (typeof buildRealisedDay === 'function') ? buildRealisedDay(iso) : null;
        var reals = ((dayObj && dayObj.activities) ? dayObj.activities : [act]).filter(function (x) { return catOf(x.raw_type || x.sport) === actCat; });
        var keyOf = function (x) { return String(x._sbId || x.client_id || x._manualId || x.id || (x.name + '|' + (x.duration || 0))); };
        var actKey = keyOf(act);
        var combos = [];
        cands.forEach(function (p, pi) { reals.forEach(function (r, ri) { combos.push({ pi: pi, ri: ri, diff: Math.abs((+p.duration || 0) - (+r.duration || 0)) }); }); });
        combos.sort(function (x, y) { return x.diff - y.diff; });
        var usedP = {}, usedR = {};
        combos.forEach(function (c) {
          if (usedP[c.pi] || usedR[c.ri]) return;
          usedP[c.pi] = 1; usedR[c.ri] = 1;
          if (keyOf(reals[c.ri]) === actKey) matched = cands[c.pi];
        });
        if (matched && matched._sbId && act._sbId) {
          act.planned_id = String(matched._sbId);
          if (typeof window.__setActPlannedLink === 'function') window.__setActPlannedLink(act._sbId, String(matched._sbId));
          if (window.cloudSync && window.cloudSync.linkActivityPlanned) window.cloudSync.linkActivityPlanned(act._sbId, String(matched._sbId));
        }
      }
    }
    return { planned: planned, matched: matched };
  } catch (e) { console.warn('[planned match]', e && e.message); return empty; }
};


// Section comparaison (corps de la modale) : uniquement si une seance prevue est rapprochee.
window.renderPrevuVsRealiseHTML = function (act, iso) {
  try {
    var mm = window.__plannedMatch(act, iso);
    var p = mm.matched;
    if (!p) return '';
    var fmtD = function (min) { return (typeof fmtDur === 'function') ? fmtDur(+min || 0) : (Math.round(+min || 0) + ' min'); };
    // Une barre par metrique : remplissage = realise, repere = cible prevue.
    // Couleur : au-dessus de la cible = vert, en dessous = orange, sans cible = neutre.
    function barRow(label, pv, rv, fmt) {
      var hasP = (pv != null && pv !== ''), hasR = (rv != null && rv !== '');
      if (!hasP && !hasR) return '';
      var pvn = +pv || 0, rvn = +rv || 0, d = rvn - pvn;
      var col = !hasP ? '#9aa6b6' : (d > 0 ? '#5fb87a' : (d < 0 ? '#d08442' : '#9aa6b6'));
      var scale = Math.max(pvn, rvn, 1);
      var fillPct = Math.max(3, Math.min(100, rvn / scale * 100));
      var targetPct = hasP ? Math.max(0, Math.min(100, pvn / scale * 100)) : null;
      var right = '<span style="color:var(--text,#e7ecf3);font-weight:600">' + (hasR ? fmt(rvn) : '—');
      if (hasP) right += ' <span style="color:var(--text-mute,#6b7686);font-weight:400">/ ' + fmt(pvn) + ' prévu</span>';
      if (hasP && hasR && d !== 0) right += ' <span style="color:' + col + '">' + (d > 0 ? '+' : '−') + fmt(Math.abs(d)) + '</span>';
      right += '</span>';
      return '<div style="margin-top:13px">'
        + '<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px"><span style="color:var(--text-dim,#9aa6b6)">' + label + '</span>' + right + '</div>'
        + '<div style="position:relative;height:7px;background:var(--bg-elev,#222b3d);border-radius:4px">'
        + '<div style="width:' + fillPct + '%;height:100%;background:' + col + ';border-radius:4px"></div>'
        + (targetPct != null ? '<div style="position:absolute;left:' + targetPct + '%;top:-2px;width:2px;height:11px;background:#cdd5e5"></div>' : '')
        + '</div></div>';
    }
    var _pKj = (p.structure && p.structure.length && window.__estKjFromStructure) ? window.__estKjFromStructure(p.structure) : null;
    var bars = ''
      + barRow('Durée', p.duration, act.duration, function (x) { return fmtD(x); })
      + barRow('Distance', p.km, act.distance_km, function (x) { return Math.round(x) + ' km'; })
      + barRow('Énergie', (_pKj != null ? Math.round(_pKj) : null), act.kj, function (x) { return Math.round(x) + ' kJ'; })
      + barRow('TSS', p.tss, act.tss, function (x) { return '' + Math.round(x); });
    if (!bars) return '';
    var structHTML = '';
    if (Array.isArray(p.structure) && p.structure.length && window.renderWorkoutProfileHTML) {
      structHTML = '<div style="margin-top:16px">'
        + '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-mute,#6b7686);margin-bottom:7px">Structure prévue (objectif)</div>'
        + window.renderWorkoutProfileHTML(p.structure, { height: 56, labels: false, sport: p.sport || act.raw_type || act.sport })
        // Adhérence par intervalle : rempli par fillAdherenceSlot() quand les streams arrivent
        + '<div id="pvr-adherence" data-structure="' + encodeURIComponent(JSON.stringify(p.structure)) + '"></div>'
        + '</div>';
      // Streams déjà en mémoire (réouverture de la même activité) : remplit direct
      setTimeout(function () { if (window.fillAdherenceSlot) window.fillAdherenceSlot(); }, 100);
    }
    return window.__collapsible('pvr', 'Prévu vs Réalisé', bars + structHTML);
  } catch (e) { console.warn('[prevu vs realise]', e && e.message); return ''; }
};


// Bouton/selecteur de lien dans le HEADER de la modale (a cote des "...").
window.__setupModalLinkSelect = function (act, iso) {
  var wrap = document.getElementById('modal-link-wrap');
  var menu = document.getElementById('modal-link-menu');
  var btn = document.getElementById('modal-link-btn');
  if (!wrap || !menu) return;
  if (!act || act.category === 'competition' || !act._sbId) { wrap.hidden = true; return; }
  var mm = window.__plannedMatch(act, iso);
  if (!mm.planned.length) { wrap.hidden = true; return; }
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var opt = function (val, label, sel) { return '<button class="pvr-opt' + (sel ? ' sel' : '') + '" type="button" data-val="' + esc(val) + '">' + label + '<span class="pvr-check">✓</span></button>'; };
  var html = opt('none', 'Aucune', !mm.matched);
  if (mm.planned.length) html += '<div class="pvr-sep"></div>';
  html += mm.planned.map(function (pp) {
    var lab = (pp.name || 'Séance') + ' · ' + ((typeof fmtDur === 'function') ? fmtDur(+pp.duration || 0) : ((+pp.duration || 0) + ' min'));
    var seld = (mm.matched && String(mm.matched._sbId) === String(pp._sbId));
    return opt(pp._sbId, esc(lab), seld);
  }).join('');
  menu.innerHTML = html;
  menu.dataset.sbid = act._sbId;
  menu.hidden = true;
  wrap.classList.remove('open');
  wrap.hidden = false;
  if (btn) btn.style.color = '';
  wrap.title = mm.matched ? ('Séance prévue liée : ' + (mm.matched.name || '')) : 'Aucune séance prévue liée';
};


// Reflete le lien prevu<->realise dans DASHBOARD_DATA (memoire) pour persistance en session.
window.__setActPlannedLink = function (sbId, val) {
  if (!Array.isArray(appState.data) || !sbId) return;
  for (var di = 0; di < appState.data.length; di++) {
    var acts = appState.data[di].activities || [];
    for (var ai = 0; ai < acts.length; ai++) {
      if (String(acts[ai]._sbId) === String(sbId)) acts[ai].planned_id = val;
    }
  }
};


// Menu custom du lien Prevu<->Realise : ouvrir / choisir / fermer
document.addEventListener('click', function (e) {
  var trg = e.target;
  var menu = document.getElementById('modal-link-menu');
  var wrap = document.getElementById('modal-link-wrap');
  var hitBtn = trg.closest ? trg.closest('#modal-link-btn') : null;
  if (hitBtn && menu) {
    e.preventDefault(); e.stopPropagation();
    menu.hidden = !menu.hidden;
    if (wrap) wrap.classList.toggle('open', !menu.hidden);
    return;
  }
  var opt = trg.closest ? trg.closest('.pvr-opt') : null;
  if (opt && menu) {
    e.preventDefault(); e.stopPropagation();
    var sbid = menu.dataset.sbid, val = opt.dataset.val;
    menu.hidden = true; if (wrap) wrap.classList.remove('open');
    if (sbid) {
      if (typeof window.__setActPlannedLink === 'function') window.__setActPlannedLink(sbid, val);
      if (window.cloudSync && window.cloudSync.linkActivityPlanned) window.cloudSync.linkActivityPlanned(sbid, val);
      if (typeof window.__modalActIdx === 'number') window.__openActIdx = window.__modalActIdx;
      if (window.__currentModalIso && typeof openSessionModal === 'function') openSessionModal(window.__currentModalIso, window.__currentModalSource || 'realise');
    }
    return;
  }
  if (menu && !menu.hidden && !(trg.closest && trg.closest('#modal-link-wrap'))) {
    menu.hidden = true; if (wrap) wrap.classList.remove('open');
  }
});


// SVGs + bloc stats reutilisable (heros + tuiles centrees, max 2 rangees).
window.__statSvg = {
  clock: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  route: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/></svg>',
  mtn: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20 9 8l3.5 6 2.5-4.5L21 20Z"/></svg>',
  bolt: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  speed: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="14" r="2"/><path d="M13.4 12.6 19 7"/><path d="M3.6 19a9 9 0 1 1 16.8 0"/></svg>'
};

// Section repliable reutilisable (bouton Masquer/Afficher a droite, etat memorise par cle).
window.__collapsible = function (key, titleInner, contentHTML) {
  var collapsed = false;
  try { collapsed = localStorage.getItem(key + '_collapsed') === '1'; } catch (e) { }
  var chev = collapsed ? '▸' : '▾';
  return '<div class="modal-section">'
    + '<div class="modal-section-title" style="display:flex;align-items:center;gap:10px">'
    +   '<span>' + titleInner + '</span>'
    +   '<button class="coll-toggle" type="button" data-key="' + key + '" style="background:var(--bg-elev2);border:1px solid var(--border2,#374256);color:var(--text-dim,#9aa6b6);border-radius:7px;padding:4px 11px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;text-transform:none;letter-spacing:0;display:inline-flex;align-items:center;gap:6px;flex:none">'
    +     '<span class="coll-label">' + (collapsed ? 'Afficher' : 'Masquer') + '</span><span class="coll-chev" style="display:inline-block;width:9px;text-align:center">' + chev + '</span>'
    +   '</button>'
    + '</div>'
    + '<div class="coll-content"' + (collapsed ? ' hidden' : '') + '>' + contentHTML + '</div>'
    + '</div>';
};

document.addEventListener('click', function (e) {
  var t = e.target.closest ? e.target.closest('.coll-toggle') : null;
  if (!t) return;
  var sec = t.closest('.modal-section');
  var content = sec ? sec.querySelector('.coll-content') : null;
  if (!content) return;
  var nowHidden = !content.hidden;
  content.hidden = nowHidden;
  var chev = t.querySelector('.coll-chev'); if (chev) chev.textContent = nowHidden ? '▸' : '▾';
  var lab = t.querySelector('.coll-label'); if (lab) lab.textContent = nowHidden ? 'Afficher' : 'Masquer';
  try { localStorage.setItem((t.dataset.key || 'coll') + '_collapsed', nowHidden ? '1' : '0'); } catch (e2) { }
});


// Estime l'energie (kJ) d'une structure planifiee : Σ (watts cibles x duree).
window.__estKjFromStructure = function (blks, ftp) {
  if (!Array.isArray(blks) || !blks.length) return null;
  ftp = +ftp || ((window.DASHBOARD_DATA && window.DASHBOARD_DATA.athlete && +window.DASHBOARD_DATA.athlete.ftp) || 250);
  var total = 0;
  blks.forEach(function (b) {
    var reps = Math.max(1, b.reps | 0);
    var segs = [b.work]; if (b.type === 'interval' && b.rec) segs.push(b.rec);
    for (var r = 0; r < reps; r++) segs.forEach(function (s) { if (!s) return; var mid = (s.intHi != null && +s.intHi > 0) ? ((+s.int + +s.intHi) / 2) : (+s.int || 0); total += (ftp * mid / 100) * ((+s.min || 0) * 60); });
  });
  return total / 1000;
};


// Même markup/classes que la modale réalisé (openSessionModal) : .act-hero-row /
// .act-hero / .act-tile-grid / .act-tile -> les styles desktop + mobile
// (modals.css, mobile.css) s'appliquent à l'identique, aucun style inline.
window.renderStatsBlockHTML = function (heroes, tiles) {
  var heroCard = function (hh) {
    return '<div class="act-hero">'
      + (hh.svg ? '<span class="act-hero-ico" style="color:' + hh.color + '">' + hh.svg + '</span>' : '')
      + '<div class="act-hero-tx"><div class="act-hero-val">' + hh.val + (hh.unit ? '<span class="act-hero-unit"> ' + hh.unit + '</span>' : '') + '</div>'
      + '<div class="act-hero-lab">' + hh.lab + '</div></div></div>';
  };
  var tileHTML = function (tt) {
    return '<div class="act-tile" style="background:' + tt.color + '17;--tile-c:' + tt.color + '">'
      + '<div class="act-tile-lab">' + tt.lab + '</div>'
      + '<div class="act-tile-val">' + tt.val + '</div></div>';
  };
  heroes = (heroes || []).filter(Boolean); tiles = (tiles || []).filter(Boolean);
  var heroRow = heroes.length ? '<div class="act-hero-row" data-n="' + Math.min(heroes.length, 4) + '">' + heroes.slice(0, 4).map(heroCard).join('') + '</div>' : '';
  var n = tiles.length, cols = n <= 4 ? Math.max(1, n) : Math.ceil(n / 2);
  var grid = n ? '<div class="act-tile-grid" data-n="' + n + '" style="--tile-cols:' + cols + ';--tile-tracks:' + (cols * 2) + '">' + tiles.map(tileHTML).join('') + '</div>' : '';
  return (heroRow || grid) ? '<div class="modal-section">' + heroRow + grid + '</div>' : '';
};


window.openSessionModal = openSessionModal; // accessible hors module (hoisting)


document.getElementById('modal-close').addEventListener('click', closeSessionModal);
}
