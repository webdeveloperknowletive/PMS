export type ProfileAvatarOption = {
  id: string;
  name: string;
  group: "Girls" | "Boys";
  background: string;
  skin: string;
  hair: string;
  shirt: string;
  style: "long" | "bob" | "curly" | "short" | "side" | "fade";
};

export const PROFILE_AVATARS: ProfileAvatarOption[] = [
  { id: "girl-1", name: "Aanya", group: "Girls", background: "#FCE7F3", skin: "#E8B894", hair: "#38251F", shirt: "#C02673", style: "long" },
  { id: "girl-2", name: "Maya", group: "Girls", background: "#EDE9FE", skin: "#A96D4F", hair: "#211A1B", shirt: "#6D4BC3", style: "bob" },
  { id: "girl-3", name: "Zara", group: "Girls", background: "#DBEAFE", skin: "#F1C9A5", hair: "#75452C", shirt: "#3285C7", style: "curly" },
  { id: "boy-1", name: "Arjun", group: "Boys", background: "#D1FAE5", skin: "#C68B64", hair: "#30251F", shirt: "#168568", style: "short" },
  { id: "boy-2", name: "Noah", group: "Boys", background: "#FEF3C7", skin: "#F0C6A0", hair: "#8B5A36", shirt: "#D08B20", style: "side" },
  { id: "boy-3", name: "Kabir", group: "Boys", background: "#CFFAFE", skin: "#8E583E", hair: "#211C1A", shirt: "#168FA1", style: "fade" },
];

export function profileAvatarSvg(avatar: ProfileAvatarOption): string {
  const hairShape: Record<ProfileAvatarOption["style"], string> = {
    long: '<path d="M148 225c-20-105 22-169 108-169s132 64 108 169l-8 171h-39l-6-114H209l-6 114h-39z"/>',
    bob: '<path d="M151 220c-18-103 22-164 105-164s123 61 105 164l-13 99-37-15-7-81H208l-7 81-37 15z"/>',
    curly: '<path d="M152 229c-20-111 20-174 104-174s124 63 104 174l-9 38-27-22-5-62H205l-5 62-27 22z"/><circle cx="168" cy="126" r="31"/><circle cx="204" cy="78" r="32"/><circle cx="255" cy="61" r="34"/><circle cx="306" cy="80" r="32"/><circle cx="343" cy="130" r="31"/>',
    short: '<path d="M158 209c-10-94 28-153 98-153s108 59 98 153l-27 23-5-60H190l-5 60z"/>',
    side: '<path d="M157 211c-11-94 27-155 100-155 72 0 108 62 97 154l-31 18-5-66H200l-5 66z"/><path d="M171 101c50-45 119-39 174 4-64-16-105-7-143 24z"/>',
    fade: '<path d="M162 197c-5-88 30-141 94-141s99 53 94 141l-25 13-5-44H192l-5 44z"/>',
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${avatar.background}"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><rect width="512" height="512" rx="256" fill="url(#bg)"/><path d="M55 512c13-105 78-158 201-158s188 53 201 158" fill="${avatar.shirt}"/><path d="M226 331h60v72h-60z" fill="${avatar.skin}"/><g fill="${avatar.hair}">${hairShape[avatar.style]}</g><ellipse cx="256" cy="222" rx="83" ry="105" fill="${avatar.skin}"/><circle cx="171" cy="231" r="14" fill="${avatar.skin}"/><circle cx="341" cy="231" r="14" fill="${avatar.skin}"/><path d="M226 222q12-10 24 0M270 222q12-10 24 0" fill="none" stroke="#3b2d29" stroke-width="7" stroke-linecap="round"/><path d="M256 229l-8 32q8 7 16 0" fill="none" stroke="#bd8069" stroke-width="5" stroke-linecap="round"/><path d="M235 282q21 18 42 0" fill="none" stroke="#8c4651" stroke-width="7" stroke-linecap="round"/><path d="M208 186q20-12 37-1M268 185q18-12 36 0" fill="none" stroke="${avatar.hair}" stroke-width="9" stroke-linecap="round"/></svg>`;
}

export async function profileAvatarToPng(avatar: ProfileAvatarOption): Promise<File> {
  const image = new Image();
  const objectUrl = URL.createObjectURL(new Blob([profileAvatarSvg(avatar)], { type: "image/svg+xml" }));
  try {
    image.src = objectUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare the avatar image.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Your browser could not save the avatar image.")), "image/png");
    });
    return new File([blob], `${avatar.id}.png`, { type: "image/png" });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
