const Spinner = ({
  className,
  size = 24,
}: {
  className?: string;
  size?: number;
}) => {
  const spinnerBars = Array.from({ length: 10 }, (_, i) => ({
    id: `bar-${i * 36}`,
    transform: i === 0 ? undefined : `rotate(${i * 36} 12 12)`,
    opacity: i === 0 ? 1 : i / 10,
  }));

  return (
    <div className={`flex flex-col justify-center items-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        className="fill-gray-600 dark:fill-gray-400"
        aria-hidden="true"
      >
        <g className="origin-center animate-spinner-circle">
          {spinnerBars.map((bar) => (
            <rect
              key={bar.id}
              x="11"
              y="1"
              width="2"
              height="6"
              transform={bar.transform}
              opacity={bar.opacity}
            />
          ))}
        </g>
      </svg>
    </div>
  );
};

export default Spinner;
