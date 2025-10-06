import { FlipForm } from "../FlipForm";

export default function FlipFormExample() {
  const handleSubmit = (flip: any) => {
    console.log("Flip submitted:", flip);
  };

  return (
    <div className="w-full max-w-md">
      <FlipForm onSubmit={handleSubmit} />
    </div>
  );
}
