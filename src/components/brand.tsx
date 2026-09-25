import Image from "next/image";
export function Brand() {
  return (
    <div className="brand">
      <Image src="/brand-mark.png" alt="" width={42} height={42} priority />
      <span>
        iSev<span className="brand-blue">Finance</span>
      </span>
    </div>
  );
}
