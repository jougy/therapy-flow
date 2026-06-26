import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ProfileAccountButtonProps {
  displayName: string;
  subtitle: string;
  avatarUrl?: string | null;
  initials: string;
  onClick: () => void;
  className?: string;
}

const ProfileAccountButton = ({
  displayName,
  subtitle,
  avatarUrl,
  initials,
  onClick,
  className,
}: ProfileAccountButtonProps) => (
  <button
    type="button"
    className={cn("profile-account-button group", className)}
    onClick={onClick}
    aria-label="Abrir configurações pessoais"
  >
    <div className="profile-account-button__text">
      <div className="profile-account-button__identity hidden sm:flex flex-col items-end">
        <span className="profile-account-button__name">{displayName}</span>
        <span className="profile-account-button__subtitle">{subtitle}</span>
      </div>
      <span className="profile-account-button__hover-label hidden sm:block" aria-hidden="true">
        Meu Perfil
      </span>
    </div>
    <div className="profile-account-button__avatar">
      <Avatar className="h-8 w-8 profile-account-button__avatar-ring">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
    </div>
  </button>
);

export default ProfileAccountButton;
