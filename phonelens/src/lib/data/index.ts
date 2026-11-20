/**
 * 数据访问层：只读取版本化 JSON。替换数据源时只需改动本文件。
 */
import metaJson from "../../../data/v1/meta.json";
import sourcesJson from "../../../data/v1/sources.json";
import phonesJson from "../../../data/v1/phones.json";
import specsJson from "../../../data/v1/specs.json";
import pricesJson from "../../../data/v1/prices.json";
import reviewsJson from "../../../data/v1/reviews.json";
import analysisJson from "../../../data/v1/analysis.json";
import auditJson from "../../../data/v1/audit.json";
import type {
  AnalysisRecord,
  AuditRecord,
  DataMeta,
  PhoneRecord,
  PriceRecord,
  ReviewRecord,
  SourceRecord,
  SpecRecord,
} from "../types";

export interface Dataset {
  meta: DataMeta;
  sources: SourceRecord[];
  phones: PhoneRecord[];
  specs: SpecRecord[];
  prices: PriceRecord[];
  reviews: ReviewRecord[];
  analysis: AnalysisRecord[];
  audit: AuditRecord[];
}

export const dataset: Dataset = {
  meta: metaJson as DataMeta,
  sources: sourcesJson as SourceRecord[],
  phones: phonesJson as PhoneRecord[],
  specs: specsJson as SpecRecord[],
  prices: pricesJson as PriceRecord[],
  reviews: reviewsJson as ReviewRecord[],
  analysis: analysisJson as AnalysisRecord[],
  audit: auditJson as AuditRecord[],
};

export function getPhone(ds: Dataset, id: string): PhoneRecord | undefined {
  return ds.phones.find((p) => p.id === id);
}

export function getSource(ds: Dataset, id: string | null): SourceRecord | undefined {
  return id ? ds.sources.find((s) => s.id === id) : undefined;
}

export function specsFor(ds: Dataset, phoneId: string): SpecRecord[] {
  return ds.specs.filter((s) => s.phone_id === phoneId);
}

export function pricesFor(ds: Dataset, phoneId: string): PriceRecord[] {
  return ds.prices.filter((p) => p.phone_id === phoneId);
}

export function reviewsFor(ds: Dataset, phoneId: string): ReviewRecord[] {
  return ds.reviews.filter((r) => r.phone_id === phoneId);
}

/** 目录精确匹配：只接受 id、完整型号或已登记别名，不做相似名称替换 */
export function resolvePhone(ds: Dataset, query: string): PhoneRecord | undefined {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return undefined;
  return ds.phones.find(
    (p) =>
      p.id === q ||
      `${p.brand} ${p.model}`.toLowerCase() === q ||
      p.model.toLowerCase() === q ||
      p.aliases.some((a) => a.toLowerCase() === q),
  );
}

/** 公开给浏览器的目录摘要（不含评论原文） */
export interface CatalogItem {
  id: string;
  brand: string;
  model: string;
  region: string;
  storage: string;
  ram: string | null;
  sale_status: PhoneRecord["sale_status"];
  data_kind: PhoneRecord["data_kind"];
  has_specs: boolean;
  review_count: number;
  aliases: string[];
  note: string;
}

export function catalog(ds: Dataset): CatalogItem[] {
  return ds.phones.map((p) => ({
    id: p.id,
    brand: p.brand,
    model: p.model,
    region: p.region,
    storage: p.storage,
    ram: p.ram,
    sale_status: p.sale_status,
    data_kind: p.data_kind,
    has_specs: specsFor(ds, p.id).some((s) => s.value !== null),
    review_count: reviewsFor(ds, p.id).length,
    aliases: p.aliases,
    note: p.note,
  }));
}
