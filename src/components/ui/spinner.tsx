const Spinner = ({
  className,
  size = 24,
}: {
  className?: string;
  size?: number;
}) => {
  const spinnerBars = Array.from({ length: 10 }, (_, i) => ({
    transform: `rotate(${i * 36} 12 12)`,
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
      >
        <g className="origin-center animate-spinner-circle">
          {spinnerBars.map((bar, index) => (
            <rect
              key={`spinner-bar-${index}`}
              x="11"
              y="1"
              width="2"
              height="6"
              transform={index === 0 ? undefined : bar.transform}
              opacity={index === 0 ? 1 : bar.opacity}
            />
          ))}
        </g>
      </svg>
    </div>
  );
};

export default Spinner;
