"""Validated CROSSFire Operator 03 camouflage preferences.
Server owns all team-mode overrides; cosmetic choices never affect hitboxes.
"""
OPERATOR_SKINS = (
    'woodland','desert','urban','arctic','jungle','navy_digital','ranger','shadow'
)
TEAM_OPERATOR_SKINS = {'azure':'arctic','ember':'shadow'}
TEAM_MODES_WITH_UNIFORMS = ('teamdeathmatch','control')

def normalize_operator_skin(value):
    return value if isinstance(value,str) and value in OPERATOR_SKINS else 'woodland'

def effective_operator_skin(player, mode):
    if player.get('bot'):
        return 'shadow'
    if mode in TEAM_MODES_WITH_UNIFORMS:
        team = player.get('team')
        if team in TEAM_OPERATOR_SKINS:
            return TEAM_OPERATOR_SKINS[team]
    return normalize_operator_skin(player.get('operator_skin_choice'))
