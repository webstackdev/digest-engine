import { FC } from "react";
import Image, { type StaticImageData } from "next/image";

import canvaLogo from "@/assets/clients/canva.svg";
import carrefourLogo from "@/assets/clients/carrefour.svg";
import cocaColaLogo from "@/assets/clients/coca-cola.svg";
import holtLogo from "@/assets/clients/holt.svg";
import lionsgateLogo from "@/assets/clients/lionsgate.svg";
import universalLogo from "@/assets/clients/universal.svg";
import vistraLogo from "@/assets/clients/vistra.svg";
import vmlLogo from "@/assets/clients/vml.svg";

import type { IClientsProps } from "@/lib/types";
import styles from "./Clients.module.css";

const clientLogos: Record<string, StaticImageData> = {
  Canva: canvaLogo,
  Carrefour: carrefourLogo,
  "Coca-Cola": cocaColaLogo,
  Holt: holtLogo,
  Lionsgate: lionsgateLogo,
  Universal: universalLogo,
  Vistra: vistraLogo,
  VML: vmlLogo,
};

/**
 * Home page social proof logo marquee with a reduced-motion fallback.
 */

const Clients: FC<IClientsProps> = ({ items }) => {
  const renderLogoGroup = (keyPrefix: string) =>
    items.map((item) => (
      <li
        key={`${keyPrefix}-${item.label}`}
        className="flex h-24 w-40 shrink-0 items-center justify-center rounded-3xl border border-trim-offset bg-page-base px-6 shadow-soft backdrop-blur-[18px] sm:h-28 sm:w-48 sm:px-8"
      >
        {clientLogos[item.label] ? (
          <Image
            src={clientLogos[item.label]}
            alt={`${item.label} logo`}
            width={160}
            height={40}
            className="h-10 w-auto max-w-full object-contain"
          />
        ) : (
          <span className="sr-only">{item.label}</span>
        )}
      </li>
    ));

  return (
    <section
      id="clients"
      aria-label="Client logos"
      className="rounded-4xl border border-trim-offset bg-page-base px-4 py-5 shadow-panel backdrop-blur-[18px] sm:px-6 sm:py-6"
    >
      <div className={styles.viewport}>
        <div className={styles.track}>
          <ul aria-label="Client logos" className={styles.group}>
            {renderLogoGroup("primary")}
          </ul>
          <ul aria-hidden="true" className={`${styles.group} ${styles.clone}`}>
            {renderLogoGroup("clone")}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default Clients;
