import { useId, type ReactNode } from "react";
import {
  House as HouseIcon,
  Apple,
  Milk,
  Carrot,
  Leaf,
  Egg,
  Cherry,
  Wheat,
  Citrus,
  MilkIcon,
  PackageOpen,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { Member } from "@/lib/household";
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true" />
      Shelf Life
    </span>
  );
}
export function HomeLabel({ name }: { name: string }) {
  return (
    <span className="home-label">
      <HouseIcon size={16} /> <span>{name}</span>
    </span>
  );
}
export function Avatar({ member }: { member: Member }) {
  return (
    <span aria-hidden="true" className={"avatar " + member.colour}>
      {member.name[0]}
    </span>
  );
}
export function FoodArt({ name }: { name: string }) {
  const list = [
    [/yoghurt|cheese/i, MilkIcon],
    [/milk/i, Milk],
    [/carrot/i, Carrot],
    [/spinach|cabbage|lettuce/i, Leaf],
    [/tomato|berry/i, Cherry],
    [/egg/i, Egg],
    [/lemon|lime/i, Citrus],
    [/pasta|bread|rice/i, Wheat],
    [/apple|pear/i, Apple],
  ] as const;
  const Icon = list.find(([re]) => re.test(name))?.[1] ?? PackageOpen;
  return (
    <span aria-hidden="true" className="food-art">
      <Icon size={26} strokeWidth={1.7} />
    </span>
  );
}
export function Modal({
  title,
  description,
  close,
  children,
}: {
  title: string;
  description: string;
  close: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <DialogContent className="sheet">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function PhotoInput({
  label,
  camera = false,
  disabled = false,
  onFile,
  children,
}: {
  label: string;
  camera?: boolean;
  disabled?: boolean;
  onFile: (file: File) => void;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <span className="photo-input">
      <input
        id={id}
        type="file"
        accept="image/*"
        capture={camera ? "environment" : undefined}
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
      <label htmlFor={id} className={camera ? "btn primary" : "btn secondary"}>
        {children}
        {label}
      </label>
    </span>
  );
}
export function Empty({ children, art = false }: { children: ReactNode; art?: boolean }) {
  if (!art) return <p className="empty">{children}</p>;
  return (
    <div className="empty empty-with-art">
      <img src="/images/empty-shelf.webp" alt="" width={200} height={140} />
      <p>{children}</p>
    </div>
  );
}
