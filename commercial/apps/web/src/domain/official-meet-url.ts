export function officialMeetUrl(input: string): string | null {
 try {
  const url=new URL(input.trim());
  if(url.protocol!=='https:'||url.username||url.password||url.port||!['swimsystem.app','www.swimsystem.app'].includes(url.hostname))return null;
  const match=url.pathname.match(/^\/meets\/sw\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/?$/i);
  return match?`https://www.swimsystem.app/meets/sw/${match[1].toLowerCase()}`:null;
 } catch {return null;}
}
export function officialRequestError(message: string): string {
 if(message.includes('OFFICIAL_IMPORT_MAINTENANCE'))return 'A importação está temporariamente indisponível enquanto concluímos a atualização.';
 if(message.includes('SOURCE_IDENTITY_ALREADY_LINKED_IN_ACCOUNT'))return 'Este registro já está vinculado a outro atleta da sua conta. Use o perfil existente.';
 if(message.includes('INVALID_OFFICIAL_SOURCE_CONFIGURATION'))return 'Confira o endereço oficial do SwimSystem, o registro e o nome do atleta.';
 if(message.includes('SOURCE_CONFIGURATION_ACCESS_DENIED'))return 'Sua conta não pode alterar esta fonte.';
 if(message.includes('SOURCE_IDENTITY_MISSING'))return 'Configure o registro do atleta na fonte oficial antes de importar.';
 if(message.includes('SOURCE_IDENTITY_CONFLICT'))return 'Há registros conflitantes para este atleta na fonte. Revise a configuração.';
 if(message.includes('ATHLETE_ACCESS_DENIED'))return 'Sua conta não tem acesso a este atleta.';
 if(message.includes('INVALID_OFFICIAL_MEET_URL'))return 'Informe a URL oficial da competição no SwimSystem.';
 return message||'Não foi possível solicitar a importação.';
}
