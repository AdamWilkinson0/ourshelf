import { useId, type ReactNode } from "react";
import {
  Sprout,
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
      <span className="brand-leaf">
        <Sprout size={25} strokeWidth={2.3} />
      </span>
      Shelf Life<span className="brand-dot">.</span>
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
    [/yoghurt|cheese/i, MilkIcon, "lilac"],
    [/milk/i, Milk, "blue"],
    [/carrot/i, Carrot, "peach"],
    [/spinach|cabbage|lettuce/i, Leaf, "sage"],
    [/tomato|berry/i, Cherry, "rose"],
    [/egg/i, Egg, "butter"],
    [/lemon|lime/i, Citrus, "butter"],
    [/pasta|bread|rice/i, Wheat, "peach"],
    [/apple|pear/i, Apple, "sage"],
  ] as const;
  const [, Icon, colour] =
    list.find(([re]) => re.test(name)) ?? ([null, PackageOpen, "sage"] as const);
  return (
    <span aria-hidden="true" className={"food-art " + colour}>
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
export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
