interface ConviteBrandingHeaderProps {
  clinicName: string;
}

export const ConviteBrandingHeader = ({ clinicName }: ConviteBrandingHeaderProps) => {
  return (
    <div className="text-center flex flex-col items-center">
      <img
        src="/branding/logo/pluri_health_icon_gradient.svg"
        alt="Pluri-Health"
        className="h-12 w-12 mb-2 drop-shadow-md"
      />
      <p className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400">Pluri-Health</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Convite de Acesso à Clínica
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Você foi convidado para fazer parte da equipe de <strong>{clinicName}</strong>.
      </p>
    </div>
  );
};
