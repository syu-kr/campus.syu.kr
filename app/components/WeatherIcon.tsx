import type { WeatherData } from "@/lib/weather";

interface WeatherIconProps {
  weather: WeatherData;
  className?: string;
  monochrome?: boolean;
}

export function WeatherIcon({
  weather,
  className = "h-6 w-6",
  monochrome = false,
}: WeatherIconProps) {
  const color = monochrome
    ? {
        sun: "#FFFFFF",
        cloud: "rgba(255,255,255,0.85)",
        cloudDark: "rgba(255,255,255,0.65)",
        rain: "#FFFFFF",
      }
    : {
        sun: "#FDB813",
        cloud: "#B0BEC5",
        cloudDark: "#78909C",
        rain: "#1976D2",
      };

  if (weather.precipitation === 1 || weather.precipitation === 5) {
    return <RainIcon className={className} color={color} />;
  }

  if (weather.precipitation === 2 || weather.precipitation === 6) {
    return <SleetIcon className={className} color={color} />;
  }

  if (weather.precipitation === 3 || weather.precipitation === 7) {
    return <SnowIcon className={className} color={color} />;
  }

  if (weather.skyCondition === 3) {
    return <PartlyCloudyIcon className={className} color={color} />;
  }

  if (weather.skyCondition === 4) {
    return <CloudyIcon className={className} color={color} />;
  }

  return <SunIcon className={className} color={color} />;
}

type IconColors = {
  sun: string;
  cloud: string;
  cloudDark: string;
  rain: string;
};

function SunIcon({
  className,
  color,
}: {
  className: string;
  color: IconColors;
}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="5" fill={color.sun} />
      {[
        ["12", "1", "12", "3"],
        ["12", "21", "12", "23"],
        ["1", "12", "3", "12"],
        ["21", "12", "23", "12"],
        ["3.5", "3.5", "4.9", "4.9"],
        ["19.1", "19.1", "20.5", "20.5"],
        ["20.5", "3.5", "19.1", "4.9"],
        ["4.9", "19.1", "3.5", "20.5"],
      ].map(([x1, y1, x2, y2]) => (
        <line
          key={`${x1}-${y1}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color.sun}
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

function CloudShape({ color }: { color: string }) {
  return (
    <path
      d="M3 14C3 12.35 4.35 11 6 11C6.2 8.9 7.9 7.3 10 7.3C11.95 7.3 13.6 8.7 13.86 10.5C15.4 10.6 16.6 11.9 16.6 13.5C16.6 15.14 15.24 16.5 13.6 16.5H4C3.45 16.5 3 16.05 3 15.5V14Z"
      fill={color}
    />
  );
}

function PartlyCloudyIcon({
  className,
  color,
}: {
  className: string;
  color: IconColors;
}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="6" cy="6" r="2.5" fill={color.sun} />
      <path
        d="M5 12C5 11.17 5.51 10.47 6.24 10.16C6.92 8.21 8.68 6.8 10.8 6.8C13.42 6.8 15.57 8.62 15.87 11H16.8C18.24 11 19.4 12.16 19.4 13.6C19.4 15.04 18.24 16.2 16.8 16.2H6C4.9 16.2 4 15.3 4 14.2C4 13.12 4.84 12.23 5.91 12.06"
        fill={color.cloud}
      />
    </svg>
  );
}

function CloudyIcon({
  className,
  color,
}: {
  className: string;
  color: IconColors;
}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <CloudShape color={color.cloud} />
      <path
        d="M8 18.2C8 17.1 8.9 16.2 10 16.2C10.15 14.7 11.3 13.5 12.8 13.5C14 13.5 15 14.3 15.3 15.4C16.3 15.5 17.1 16.3 17.1 17.4C17.1 18.6 16.14 19.6 15 19.6H9C8.45 19.6 8 19.15 8 18.6V18.2Z"
        fill={color.cloudDark}
      />
    </svg>
  );
}

function RainIcon({
  className,
  color,
}: {
  className: string;
  color: IconColors;
}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <CloudShape color={color.cloud} />
      {[5, 9, 13].map((x) => (
        <line
          key={x}
          x1={x}
          y1="17"
          x2={x - 1}
          y2="21"
          stroke={color.rain}
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

function SleetIcon({
  className,
  color,
}: {
  className: string;
  color: IconColors;
}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <CloudShape color={color.cloud} />
      {[5, 13].map((x) => (
        <line
          key={x}
          x1={x}
          y1="17"
          x2={x - 1}
          y2="21"
          stroke={color.rain}
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
      <circle cx="9" cy="20" r="1.5" fill={color.rain} />
    </svg>
  );
}

function SnowIcon({
  className,
  color,
}: {
  className: string;
  color: IconColors;
}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <CloudShape color={color.cloud} />
      {[6, 10, 14].map((x) => (
        <g key={x} stroke={color.rain} strokeWidth="1.4" strokeLinecap="round">
          <line x1={x} y1="18" x2={x} y2="22" />
          <line x1={x - 1.5} y1="20" x2={x + 1.5} y2="20" />
        </g>
      ))}
    </svg>
  );
}
