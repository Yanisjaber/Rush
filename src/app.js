/* ============================================================
   src/app.js — Point d'entrée de l'application.

   Ce fichier ne contient plus de logique : il charge les modules
   (core/, features/<sujet>/, routing/) puis appelle leur fonction
   bootXxx() dans l'ordre d'origine. L'état partagé (données, jour
   courant, modes du calendrier, graphiques, éléments DOM) vit dans
   src/core/state.js (appState).

   Notes :
   - Modules ES (strict mode). Les librairies (Chart.js, Leaflet,
     Flatpickr) sont des globaux : window.Chart, window.L, window.flatpickr.
   - Les données viennent de Supabase (voir core/supabase-data-loader.js).
   ============================================================ */

// ========= SUPABASE (client + auth + storage adapter + cloud sync + data loader + Strava OAuth) =========
// Doit être chargé EN PREMIER pour que les autres modules aient accès à window.sb.
import './core/supabase-client.js';
import './features/auth/auth.js';
import './features/profile/profile-modal.js';
import './core/storage-adapter.js';
import './core/cloud-sync.js';
import './core/supabase-data-loader.js';
import './features/integrations/strava-oauth.js';
import './features/integrations/connections-modal.js';
import './features/settings/settings-modal.js';
import './features/help/help-modal.js';
// ========= MODE IA / MANUEL =========
import './core/app-mode.js';
// ========= WORKOUT BUILDER (séances structurées par blocs) =========
import './features/training/workout-builder.js';
// Editeur de seance structuree (style Nolio) pour la modale prevu. Doit etre importe
// APRES workout-builder pour surcharger les 3 fonctions pivot.
import './features/training/session-builder.js';
import './features/training/structure-editor.js';
import './features/training/gpx-field.js';
// ========= POWER PROFILE (Mean Maximal Power) =========
// Lit window.DASHBOARD_DATA.power_profile (calculé côté Supabase).
// Auto-render au DOMContentLoaded.
import './features/performance/power-profile.js';
// ========= DAY EXTRAS (actions rapides sur un jour du calendrier) =========
// Bouton "+" au hover, popover : ajouter entraînement / note / repos / cycle (phase).
// Auto-bootstrap + MutationObserver sur #week-calendar pour ré-attacher après chaque render.
import './features/training/sport-profiles.js';
import './features/training/day-extras.js';
import './core/ui/scroll-lock.js';
import './features/training/adherence.js';
import './features/training/rpe-scale.js';
// ========= BILAN ANNUEL (nouvelle page p3, remplace Tendances long-terme) =========
// KPIs YTD vs N-1, objectifs annuels, records, cumul kilométrique annuel.
import './features/bilan/bilan.js';
import './features/training/library.js';
import './features/opendossard/opendossard.js';
import './features/coach/coach-ai.js';

// ========= Modules découpés : initialisation dans l'ordre d'origine =========
import { bootFormat } from './core/format.js';
import { bootOverrides } from './features/calendar/overrides.js';
import { bootInit } from './features/dashboard/init.js';
import { bootHeroKpi } from './features/dashboard/hero-kpi.js';
import { bootChartsCore } from './features/dashboard/charts-core.js';
import { bootFilters } from './features/dashboard/filters.js';
import { bootChartLoad } from './features/dashboard/chart-load.js';
import { bootChartHours } from './features/dashboard/chart-hours.js';
import { bootChartWeekly } from './features/dashboard/chart-weekly.js';
import { bootChartZones } from './features/dashboard/chart-zones.js';
import { bootCompetitionsPage } from './features/competitions/competitions-page.js';
import { bootCompModalUi } from './features/competitions/comp-modal-ui.js';
import { bootCompStages } from './features/competitions/comp-stages.js';
import { bootCompForm } from './features/competitions/comp-form.js';
import { bootTrainModal } from './features/training/train-modal.js';
import { bootTemplateModal } from './features/training/template-modal.js';
import { bootRealiseCalendar } from './features/calendar/realise-calendar.js';
import { bootWeekSummary } from './features/calendar/week-summary.js';
import { bootDragDrop } from './features/calendar/drag-drop.js';
import { bootSportsCatalog } from './core/sports-catalog.js';
import { bootStreamsSection } from './features/streams/streams-section.js';
import { bootDetailedAnalysis } from './features/streams/detailed-analysis.js';
import { bootStructurePage } from './features/training/structure-page.js';
import { bootGpxRender } from './features/gpx/gpx-render.js';
import { bootSessionModal } from './features/sessions/session-modal.js';
import { bootDialogs } from './core/ui/dialogs.js';
import { bootSessionActions } from './features/sessions/session-actions.js';
import { bootChat } from './features/coach/chat.js';
import { bootSessionsPanel } from './features/sessions/sessions-panel.js';
import { bootTabs } from './routing/tabs.js';

bootFormat();
bootOverrides();
await bootInit();
bootHeroKpi();
bootChartsCore();
bootFilters();
bootChartLoad();
bootChartHours();
bootChartWeekly();
bootChartZones();
bootCompetitionsPage();
bootCompModalUi();
bootCompStages();
bootCompForm();
bootTrainModal();
bootTemplateModal();
bootRealiseCalendar();
bootWeekSummary();
bootDragDrop();
bootSportsCatalog();
bootStreamsSection();
bootDetailedAnalysis();
bootStructurePage();
bootGpxRender();
bootSessionModal();
bootDialogs();
bootSessionActions();
bootChat();
bootSessionsPanel();
bootTabs();
