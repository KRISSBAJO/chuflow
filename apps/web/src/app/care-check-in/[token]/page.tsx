import { getTranslations } from "next-intl/server";
import { publicServerGet } from "@/lib/server-api";
import { CareCheckIn } from "@/components/care/care-check-in";
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const info=await publicServerGet<{churchName:string;kind:string}>("/care/public/"+encodeURIComponent(token)).catch(()=>null);
  if(!info){
    const t = await getTranslations("people.care.checkInPage");
    return <main className="mx-auto max-w-lg px-6 py-20"><h1 className="text-2xl font-semibold">{t("unavailableTitle")}</h1><p className="mt-4 text-[#6b6b6b]">{t("unavailableBody")}</p></main>;
  }
  return <CareCheckIn token={token} info={info}/>;
}
