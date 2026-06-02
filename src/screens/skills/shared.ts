import { StyleSheet } from 'react-native';
import { AgentTool } from '../../types';
import { ColorPalette, radii, spacing } from '../../theme';

// --- Constants ---

export const SKILL_CATEGORIES = [
  { key: 'all', label: 'skillsAll' },
  { key: 'seo', label: 'skillsSeo' },
  { key: 'strategy', label: 'skillsStrategy' },
  { key: 'content', label: 'skillsContent' },
  { key: 'ecommerce', label: 'skillsEcommerce' },
  { key: 'local', label: 'skillsLocal' },
  { key: 'youtube', label: 'skillsYoutube' },
  { key: 'productivity', label: 'skillsProductivity' },
  { key: 'legal', label: 'skillsLegal' },
] as const;

export const TOOL_CATEGORIES = [
  { key: 'all', label: 'toolCatAll' },
  { key: 'research', label: 'toolCatResearch' },
  { key: 'generation', label: 'toolCatGeneration' },
  { key: 'seo', label: 'toolCatSeo' },
  { key: 'social', label: 'toolCatSocial' },
  { key: 'analytics', label: 'toolCatAnalytics' },
  { key: 'files', label: 'toolCatFiles' },
  { key: 'data', label: 'toolCatData' },
  { key: 'integration', label: 'toolCatIntegration' },
  { key: 'orchestration', label: 'toolCatOrchestration' },
  { key: 'other', label: 'toolCatOther' },
] as const;

export const CATEGORY_OPTIONS = SKILL_CATEGORIES.filter((c) => c.key !== 'all');

// Map backend category names to our normalized keys
export function normalizeToolCategory(cat: string): string {
  const map: Record<string, string> = {
    research: 'research', search: 'research',
    generation: 'generation', content: 'generation', media: 'generation',
    seo: 'seo', analysis: 'seo',
    social: 'social',
    analytics: 'analytics',
    files: 'files', file: 'files',
    data: 'data', execution: 'data',
    integration: 'integration', api: 'integration', oauth: 'integration',
    orchestration: 'orchestration',
  };
  return map[cat?.toLowerCase()] || 'other';
}

// French translations for tool descriptions (user-facing)
export const TOOL_DESC_FR: Record<string, string> = {
  search_web: 'Recherche sur le web en temps reel',
  analyze_website: 'Analyse technique et SEO d\'un site web',
  generate_content: 'Generation de contenu (articles, posts, emails)',
  generate_video: 'Creation de videos IA',
  execute_code: 'Execution de code JavaScript/Python en sandbox',
  browse_web: 'Navigation web et extraction de contenu',
  deep_research: 'Recherche approfondie multi-sources',
  dispatch_task: 'Delegation de taches a des agents specialises',
  keyword_research: 'Recherche de mots-cles SEO avec volumes',
  generate_pptx: 'Creation de presentations PowerPoint',
  generate_xlsx: 'Creation de tableurs Excel',
  generate_docx: 'Creation de documents Word',
  backend_api: 'Appel aux APIs FlowContent',
  nango_proxy: 'Acces aux integrations OAuth (Google, Meta...)',
  youtube_manager: 'Gestion de chaine YouTube',
  pinterest_manager: 'Gestion de compte Pinterest',
  analyze_ga4: 'Analyse Google Analytics 4',
  orchestrate: 'Orchestration multi-agents en parallele',
  run_skill: 'Execution de pipelines multi-etapes',
  spawn_worker: 'Lancement d\'agents en arriere-plan',
  async_task: 'Taches asynchrones avec suivi',
  generate_image: 'Generation d\'images IA',
  send_email: 'Envoi d\'emails',
  manage_calendar: 'Gestion d\'agenda Google Calendar',
  social_post: 'Publication sur les reseaux sociaux',
  get_user_context: 'Recuperation du contexte utilisateur',
  generate_youtube_video: 'Creation de videos YouTube',
  stripe_manager: 'Gestion des paiements Stripe',
  shopify_manager: 'Gestion boutique Shopify',
  notion_manager: 'Gestion de pages Notion',
  google_sheets: 'Lecture/ecriture Google Sheets',
  google_docs: 'Creation de documents Google Docs',
  google_drive: 'Gestion de fichiers Google Drive',
};

// Generate a human-readable prompt for a tool
export function getToolPrompt(tool: AgentTool): string {
  const name = tool.name.replace(/_/g, ' ');
  if (tool.example) return tool.example;
  // Generate smart suggestions based on common tools
  const prompts: Record<string, string> = {
    generate_pptx: 'Crée une présentation PowerPoint sur [mon sujet]',
    generate_xlsx: 'Crée un tableau Excel avec [mes données]',
    generate_docx: 'Crée un document Word sur [mon sujet]',
    search_web: 'Recherche sur le web : [ma question]',
    generate_content: 'Génère du contenu sur [mon sujet]',
    generate_video: 'Crée une vidéo sur [mon sujet]',
    analyze_website: 'Analyse le site [url]',
    execute_code: 'Exécute ce code : [code]',
    browse_web: 'Va sur [url] et résume le contenu',
    deep_research: 'Fais une recherche approfondie sur [sujet]',
    dispatch_task: 'Lance une tâche : [description]',
    analyze_ga4: 'Analyse mes données Google Analytics',
    keyword_research: 'Trouve des mots-clés pour [niche]',
    youtube_manager: 'Gère ma chaîne YouTube : [action]',
    pinterest_manager: 'Publie sur Pinterest : [description]',
    nango_proxy: 'Utilise mon intégration [service] pour [action]',
  };
  return prompts[tool.name] || `Utilise l'outil ${name} pour [ma demande]`;
}

export const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  createBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.full,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBadge: {
    backgroundColor: colors.accent,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  headerBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  // Tabs
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.tertiary,
    borderRadius: radii.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radii.sm,
  },
  tabActive: {
    backgroundColor: colors.accent,
  },
  tabText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.white,
    fontWeight: '800',
  },
  // Chips
  tabContent: {
    flex: 1,
  },
  chipsWrapper: {
    zIndex: 1,
    backgroundColor: colors.primary,
    paddingBottom: spacing.sm,
  },
  chipsContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radii.full,
    backgroundColor: colors.tertiary,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  // Tools search
  toolSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.secondary,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  toolSearchInput: {
    flex: 1,
    color: colors.text,
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
  toolSearchCount: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  // List
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyText: {
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xxl,
    fontSize: 14,
  },
  // Cards
  card: {
    backgroundColor: colors.secondary,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'capitalize',
  },
  cardBadge: {
    backgroundColor: colors.tertiary,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cardBadgeText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  cardDesc: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cardSteps: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  cardTools: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  toolExample: {
    color: colors.textTertiary,
    fontSize: 11,
    fontStyle: 'italic',
    flex: 1,
    marginRight: 8,
  },
  customBadge: {
    backgroundColor: colors.accent + '22',
    borderRadius: radii.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  customBadgeText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '600',
  },
  launchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.sm,
  },
  launchBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  // Mode badges
  modeActiveBadge: {
    backgroundColor: colors.success,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  modeActiveBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  modeDeactivateBtn: {
    backgroundColor: colors.error,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalScroll: {
    flex: 1,
    marginTop: 60,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.secondary,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.xl,
    maxHeight: '100%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'capitalize',
    flex: 1,
  },
  modalDesc: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  modalMeta: {
    marginBottom: spacing.lg,
  },
  modalMetaText: {
    color: colors.textTertiary,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  toolsSection: {
    marginBottom: spacing.lg,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  toolChip: {
    backgroundColor: colors.tertiary,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 160,
  },
  toolChipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  toolChipText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  toolChipTextSelected: {
    color: colors.white,
  },
  selectedToolsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  selectedToolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 160,
  },
  selectedToolText: {
    color: colors.white,
    fontSize: 11,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  formLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: colors.tertiary,
    color: colors.text,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  formInputMulti: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  formInputLarge: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  catScroll: {
    marginTop: 4,
  },
  catRow: {
    flexDirection: 'row',
    gap: 6,
  },
  modalLaunchBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  modalLaunchDisabled: {
    opacity: 0.4,
  },
  modalLaunchText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  modalCancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    alignItems: 'center',
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: spacing.md,
  },
  // Tool prompt edit modal
  toolPromptModal: {
    backgroundColor: colors.secondary,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 'auto' as any,
  },
  toolPromptHint: {
    color: colors.textTertiary,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  toolPromptInput: {
    minHeight: 100,
    maxHeight: 200,
    textAlignVertical: 'top',
  },
});

export type SkillsStyles = ReturnType<typeof createStyles>;
