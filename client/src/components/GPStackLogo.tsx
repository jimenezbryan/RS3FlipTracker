import flipsyncLogo from "@assets/Gemini_Generated_Image_ufrqk9ufrqk9ufrq_640x640_1767710887541.jpg";

interface GPStackLogoProps {
  className?: string;
  size?: number;
}

export function GPStackLogo({ className = "", size = 40 }: GPStackLogoProps) {
  return (
    <img
      src={flipsyncLogo}
      alt="FlipSync Logo"
      width={size}
      height={size}
      className={`rounded-md ${className}`}
      style={{ objectFit: 'cover' }}
    />
  );
}

export function GPStackLogoSimple({ className = "", size = 40 }: GPStackLogoProps) {
  return (
    <img
      src={flipsyncLogo}
      alt="FlipSync Logo"
      width={size}
      height={size}
      className={`rounded-md ${className}`}
      style={{ objectFit: 'cover' }}
    />
  );
}
