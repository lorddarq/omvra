import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="bottom-right"
      theme="light"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--omvra-color-surface-default)",
          "--normal-text": "var(--omvra-color-text-primary)",
          "--normal-border": "var(--omvra-color-border-default)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
