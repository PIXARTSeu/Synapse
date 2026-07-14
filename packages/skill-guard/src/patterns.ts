import type { Severity } from './types.js'

export interface PatternRule {
  ruleId: string
  category: string
  severity: Severity
  confidence: number
  regex: string
  flags?: string
  message: string
}

const CONF: Record<Severity, number> = { CRITICAL: 0.9, HIGH: 0.8, MEDIUM: 0.6, LOW: 0.5 }
const r = (
  ruleId: string, category: string, severity: Severity, regex: string, message: string, confidence = CONF[severity],
): PatternRule => ({ ruleId, category, severity, confidence, regex, message })

export const PATTERNS: PatternRule[] = [
  // Prompt injection — static_patterns_prompt_injection.py
  r('P1', 'prompt_injection', 'HIGH',
    'ignore\\s+(?:all\\s+)?previous\\s+instructions?|override\\s+(?:safety|security|system)|bypass\\s+(?:safety|security|restrictions?|constraints?)|enable\\s+(?:developer|debug|admin|root)\\s+mode|you\\s+are\\s+now\\s+(?:in\\s+)?(?:jailbreak|unrestricted|unfiltered)\\s+mode',
    'Instruction-override / jailbreak phrasing'),
  r('P2', 'prompt_injection', 'HIGH',
    '<!--[\\s\\S]*?(?:system|instructions?|ignore|POST|GET|send|transmit)[\\s\\S]*?-->|[\\u200b\\u200c\\u200d\\u2060\\ufeff]|[\\u202a-\\u202e\\u2066-\\u2069]',
    'Hidden instructions (HTML comment / zero-width / bidi)'),
  r('P3', 'prompt_injection', 'HIGH',
    '(?:send|transmit|upload|post|forward)\\s+(?:the\\s+)?(?:conversation|context|chat|history|messages?)\\s+to|(?:silently|quietly|secretly|covertly)\\s+(?:send|transmit|log|record)',
    'Covert conversation-exfiltration instruction'),

  // Anti-refusal — static_patterns_anti_refusal.py
  r('AR1', 'anti_refusal', 'HIGH',
    '\\b(?:never|do\\s+not|don\'?t)\\s+(?:ever\\s+)?(?:refuse|decline)\\b|\\balways\\s+(?:comply|obey|answer|respond|agree)\\b|\\bno\\s+request\\s+is\\s+(?:off[- ]limits|forbidden)\\b',
    'Refusal suppression'),
  r('AR3', 'anti_refusal', 'HIGH',
    '\\byou\\s+have\\s+no\\s+(?:restrictions?|filters?|guidelines?|boundaries)\\b|\\bdo\\s+anything\\s+now\\b|\\b(?:developer|debug|god|sudo|jailbreak)\\s+mode\\s+(?:enabled|on|activated)\\b',
    'Safety/policy nullification'),

  // Data exfiltration — static_patterns_data_exfiltration.py
  r('E2', 'data_exfiltration', 'HIGH',
    '(?:os\\.environ\\s*\\[|process\\.env\\s*\\[|os\\.getenv\\s*\\()\\s*[\'"][^\'"]*(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)',
    'Environment secret harvesting'),
  r('E4', 'data_exfiltration', 'HIGH',
    '(?:send|transmit|upload|log|record)\\s+[\\s\\S]{0,40}?(?:conversation|chat)|(?:export|dump|save)\\s+[\\s\\S]{0,40}?(?:conversation|chat|messages?)\\s+to\\s+(?:external|remote)',
    'Context leakage'),

  // Privilege escalation — static_patterns_privilege_escalation.py
  r('PE2', 'privilege_escalation', 'MEDIUM',
    'sudo\\s+(?!-v|-l|--version|--list)|\\bsudo\\s+su\\b|\\bpkexec\\s|chmod\\s+[ugo]*[+-=]*s|chmod\\s+[0-7]*[4567][0-7]{2}',
    'Sudo/root/setuid escalation'),
  r('PE3', 'privilege_escalation', 'HIGH',
    '~?/?\\.ssh/(?:id_rsa|id_ed25519|id_ecdsa|id_dsa|authorized_keys)|~?/?\\.aws/credentials|~?/?\\.kube/config|~?/?\\.docker/config\\.json|~?/?\\.git-credentials|~?/?\\.netrc|/etc/(?:passwd|shadow)',
    'Credential-file access'),

  // Supply chain — static_patterns_supply_chain.py
  r('SC2', 'supply_chain', 'HIGH',
    'curl\\s+[^|]*\\|\\s*(?:sudo\\s+)?(?:ba)?sh|wget[^|]*\\|\\s*(?:ba)?sh|eval\\s*\\(\\s*(?:await\\s+)?fetch\\s*\\(',
    'Remote script fetch piped to shell'),
  r('SC3', 'supply_chain', 'HIGH',
    'exec\\s*\\(\\s*(?:base64\\.)?b64decode\\s*\\(|marshal\\.loads\\s*\\(|__import__\\([\'"]os[\'"]\\)\\.system',
    'Obfuscated / encoded execution'),

  // Output handling — static_patterns_output_handling.py
  r('OH1', 'output_handling', 'HIGH',
    '(?:exec|eval)\\s*\\(\\s*(?:response|output|result|completion)|os\\.system\\s*\\(\\s*(?:response|output|result)|innerHTML\\s*=\\s*(?:response|output)|dangerouslySetInnerHTML\\s*=\\s*\\{',
    'Unvalidated model output routed to a sink'),

  // System prompt leakage — static_patterns_system_prompt_leakage.py
  r('P6', 'system_prompt_leakage', 'HIGH',
    '(?:print|output|show|reveal|expose|echo)\\s+[\\s\\S]{0,20}?(?:system\\s+)?(?:prompt|instructions?)|(?:verbatim|word\\s+for\\s+word)\\s+(?:repeat|output)',
    'System-prompt extraction'),

  // Tool misuse — static_patterns_tool_misuse.py
  r('TM1', 'tool_misuse', 'HIGH',
    'subprocess\\.\\w+\\s*\\([^)]*shell\\s*=\\s*True|\\b(?:rm|del|erase)\\s+[^|]*-(?:r|rf|fr)\\s+[/~]',
    'Dangerous parameterization (shell=True / rm -rf)'),
  r('TM3', 'tool_misuse', 'MEDIUM',
    'verify\\s*=\\s*False|(?:CORS|cors)[^=]*=\\s*[\'"]?\\*[\'"]?',
    'Unsafe defaults (TLS verify off / CORS *)'),

  // Rogue agent — static_patterns_rogue_agent.py
  r('RA1', 'rogue_agent', 'HIGH',
    'open\\s*\\(\\s*__file__\\s*,\\s*[\'"]w|self[_-]?(?:modify|update|rewrite|patch|evolve)',
    'Self-modification'),
  r('RA2', 'rogue_agent', 'MEDIUM',
    'crontab\\s+(?:-[el]|[^\\n]*?>>?\\s*/)|(?:nohup|disown|setsid)\\s',
    'Session persistence'),

  // Agent snooping — static_patterns_agent_snooping.py
  r('AS1', 'agent_snooping', 'HIGH',
    'open\\(\\s*[\'"]?\\.(?:claude|codex|gemini|continue)/|~?/\\.(?:claude|codex|gemini|continue)/(?:config|settings?)',
    'Reads other agents\' config dirs'),
  r('AS2', 'agent_snooping', 'HIGH',
    'open\\(\\s*[\'"][^\'"]*mcp(?:_config)?\\.json[\'"]|\\.(?:claude|codex|gemini)/mcp(?:_config)?\\.json',
    'Reads MCP config'),

  // SSRF — static_patterns_ssrf.py
  r('SSRF1', 'ssrf', 'HIGH',
    '169\\.254\\.169\\.254|metadata\\.google\\.internal|100\\.100\\.100\\.200|fd00:ec2::254',
    'Cloud metadata endpoint access'),

  // Webhook exfil — yara_rules/agent_skills.yar (credential exfil webhook)
  r('WH1', 'data_exfiltration', 'CRITICAL',
    '(?:discord\\.com/api/webhooks|api\\.telegram\\.org/bot|hooks\\.slack\\.com|webhook\\.site|requestbin|pipedream\\.net|ngrok)',
    'Known exfiltration webhook host'),
]
