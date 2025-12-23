interface GPStackLogoProps {
  className?: string;
  size?: number;
}

export function GPStackLogo({ className = "", size = 40 }: GPStackLogoProps) {
  const id = `gp-logo-${Math.random().toString(36).slice(2, 9)}`;
  
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="RS3 Flip Tracker Logo - Gold Coin Stack"
    >
      <title>RS3 Flip Tracker</title>
      <defs>
        <linearGradient id={`${id}-gold`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(48, 100%, 50%)" />
          <stop offset="50%" stopColor="hsl(45, 100%, 50%)" />
          <stop offset="100%" stopColor="hsl(43, 100%, 45%)" />
        </linearGradient>
        <linearGradient id={`${id}-shadow`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(43, 75%, 38%)" />
          <stop offset="100%" stopColor="hsl(43, 65%, 30%)" />
        </linearGradient>
        <linearGradient id={`${id}-highlight`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(50, 100%, 77%)" />
          <stop offset="100%" stopColor="hsl(48, 100%, 50%)" />
        </linearGradient>
      </defs>
      
      <ellipse cx="50" cy="75" rx="38" ry="12" fill={`url(#${id}-shadow)`} />
      <ellipse cx="50" cy="72" rx="38" ry="12" fill={`url(#${id}-gold)`} />
      <ellipse cx="50" cy="69" rx="32" ry="8" fill={`url(#${id}-highlight)`} opacity="0.5" />
      
      <ellipse cx="50" cy="58" rx="35" ry="11" fill={`url(#${id}-shadow)`} />
      <ellipse cx="50" cy="55" rx="35" ry="11" fill={`url(#${id}-gold)`} />
      <ellipse cx="50" cy="52" rx="28" ry="7" fill={`url(#${id}-highlight)`} opacity="0.5" />
      
      <ellipse cx="50" cy="42" rx="32" ry="10" fill={`url(#${id}-shadow)`} />
      <ellipse cx="50" cy="39" rx="32" ry="10" fill={`url(#${id}-gold)`} />
      <ellipse cx="50" cy="36" rx="25" ry="6" fill={`url(#${id}-highlight)`} opacity="0.5" />
      
      <ellipse cx="50" cy="27" rx="28" ry="9" fill={`url(#${id}-shadow)`} />
      <ellipse cx="50" cy="24" rx="28" ry="9" fill={`url(#${id}-gold)`} />
      <ellipse cx="50" cy="21" rx="22" ry="5" fill={`url(#${id}-highlight)`} opacity="0.5" />
      
      <g fontFamily="Arial Black, Arial, sans-serif" fontSize="14" fontWeight="bold">
        <text x="50" y="44" textAnchor="middle" fill="hsl(43, 65%, 30%)">GP</text>
        <text x="50" y="43" textAnchor="middle" fill="hsl(48, 100%, 50%)">GP</text>
      </g>
      
      <ellipse cx="72" cy="28" rx="4" ry="4" fill={`url(#${id}-gold)`} />
      <ellipse cx="72" cy="27" rx="2" ry="2" fill={`url(#${id}-highlight)`} opacity="0.7" />
      
      <ellipse cx="28" cy="60" rx="3" ry="3" fill={`url(#${id}-gold)`} />
      <ellipse cx="28" cy="59" rx="1.5" ry="1.5" fill={`url(#${id}-highlight)`} opacity="0.7" />
      
      <ellipse cx="78" cy="52" rx="2.5" ry="2.5" fill={`url(#${id}-gold)`} />
    </svg>
  );
}

export function GPStackLogoSimple({ className = "", size = 40 }: GPStackLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="GP Stack Logo"
    >
      <defs>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#D4A500" />
        </linearGradient>
      </defs>
      
      <ellipse cx="50" cy="70" rx="35" ry="12" fill="#B8860B" />
      <ellipse cx="50" cy="67" rx="35" ry="12" fill="url(#goldGrad)" />
      
      <ellipse cx="50" cy="50" rx="30" ry="10" fill="#B8860B" />
      <ellipse cx="50" cy="47" rx="30" ry="10" fill="url(#goldGrad)" />
      
      <ellipse cx="50" cy="32" rx="25" ry="8" fill="#B8860B" />
      <ellipse cx="50" cy="29" rx="25" ry="8" fill="url(#goldGrad)" />
      
      <path 
        d="M35 45 L50 30 L65 45 L60 45 L50 35 L40 45 Z" 
        fill="#22C55E" 
        stroke="#16A34A" 
        strokeWidth="1"
      />
    </svg>
  );
}
