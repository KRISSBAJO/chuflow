export type FormLanguage = "en" | "es";
export function formLanguage(value?: string | null): FormLanguage {
  return value === "es" ? "es" : "en";
}

const SPANISH: Record<string, string> = {
  "Member Intake and Growth Record":
    "Registro de ingreso y crecimiento de miembros",
  "Winners First Timer Form": "Formulario de primera visita de Winners",
  "Tell us who you are and the basics of this visit.":
    "Cuéntenos quién es y los datos básicos de esta visita.",
  "Confirm the details before you send this intake.":
    "Confirme los datos antes de enviar este formulario.",
  "We are honored you worshipped with us today":
    "Es un honor que haya compartido con nosotros hoy",
  "Welcome home. Help us receive you well.":
    "Bienvenido a casa. Ayúdenos a darle una buena bienvenida.",
  "Choose yes if this member has attended Believers Foundation Class.":
    "Seleccione Sí si ha asistido a la Clase de Fundamentos para Creyentes.",
  "Use the class date when known. If only the year is known, enter a representative date in that year.":
    "Indique la fecha de la clase si la conoce. Si solo conoce el año, elija una fecha de ese año.",
  "BCC is treated as a Bible school course record.":
    "BCC se registra como un curso de escuela bíblica.",
  "LCC is treated as a Bible school course record.":
    "LCC se registra como un curso de escuela bíblica.",
  "LCD is treated as a Bible school course record.":
    "LCD se registra como un curso de escuela bíblica.",
  "Enter a valid phone number, including country code":
    "Ingrese un teléfono válido con código de país.",
  "Permission to follow up is required":
    "Se requiere su autorización para que podamos contactarle.",
  "Could not save. Please try again.":
    "No se pudo guardar. Inténtelo de nuevo.",
  "An email address is required when email is the preferred contact method":
    "Ingrese un correo electrónico si desea que le contactemos por ese medio.",
  "Powered by": "Desarrollado por",
  Identity: "Identidad",
  Contact: "Contacto",
  "Follow-up": "Seguimiento",
  "Bible School": "Escuela bíblica",
  "How can the church reach and locate you well?":
    "¿Cómo puede la iglesia comunicarse con usted y ubicarle?",
  "Help us understand your family context and next-care needs.":
    "Cuéntenos sobre su familia y cómo podemos acompañarle.",
  "Capture the member's core record and joining details.":
    "Complete sus datos personales y la información de ingreso a la iglesia.",
  "Keep communication and household details up to date.":
    "Mantenga actualizados sus datos de contacto y familiares.",
  "Track BFC, BCC, LCC, and LCD attendance with date and location.":
    "Registre su asistencia a BFC, BCC, LCC y LCD, con fecha y lugar.",
  "Member record received": "Hemos recibido su registro de miembro",
  "Your member intake details have been submitted successfully.":
    "Sus datos de miembro se han enviado correctamente.",
  "Use the day the member was received into this church branch.":
    "Indique la fecha en que ingresó a esta sede de la iglesia.",
  "Use the member’s church title when it applies.":
    "Indique el título que utiliza en la iglesia, si corresponde.",
  "Choose the member’s current standing in the branch.":
    "Seleccione su estado actual de membresía en la sede.",
  "Tell us about yourself so we can welcome you well.":
    "Cuéntenos sobre usted para que podamos darle la bienvenida.",
  "A member with the same name and phone/email already exists":
    "Ya existe un miembro con el mismo nombre y teléfono o correo electrónico.",
  "Guest with this phone or email already exists":
    "Ya existe un visitante con este teléfono o correo electrónico.",
  "First name": "Nombre",
  "Last name": "Apellido",
  "First Name": "Nombre",
  "Last Name": "Apellido",
  Email: "Correo electrónico",
  Phone: "Teléfono",
  "Phone number": "Número de teléfono",
  "Phone, including country code": "Teléfono con código de país",
  "For example, +1 615 555 0123": "Por ejemplo, +1 615 555 0123",
  "City or area": "Ciudad o zona",
  City: "Ciudad",
  State: "Estado o provincia",
  "Zip code": "Código postal",
  "Street address": "Dirección",
  "Preferred way to connect": "Medio de contacto preferido",
  "What would you like help with?": "¿En qué le gustaría recibir ayuda?",
  "Choose if you wish": "Seleccione una opción si lo desea",
  "Best time to contact you": "Mejor horario para contactarle",
  "Include your time zone if helpful.": "Puede incluir su zona horaria.",
  "For example, weekday evenings": "Por ejemplo, por las tardes entre semana",
  "How can we pray for you?": "¿Cómo podemos orar por usted?",
  "Prayer request": "Petición de oración",
  "Optional. Only share what you’re comfortable sharing with the church care team.":
    "Opcional. Comparta solo lo que desee con el equipo de atención de la iglesia.",
  "Phone call": "Llamada telefónica",
  "Text message": "Mensaje de texto",
  "In person": "En persona",
  Prayer: "Oración",
  "Learning about faith": "Aprender sobre la fe",
  "Visiting church": "Visitar la iglesia",
  "Speaking with a pastor": "Hablar con un pastor",
  "Staying connected": "Mantener el contacto",
  "Tell us about yourself": "Cuéntenos sobre usted",
  "How can we support you?": "¿Cómo podemos ayudarle?",
  "Your details": "Sus datos",
  "How we can help": "Cómo podemos ayudarle",
  Continue: "Continuar",
  Back: "Atrás",
  "Submit form": "Enviar formulario",
  "Connect with us": "Conecte con nosotros",
  "Submitting…": "Enviando…",
  "Submitting...": "Enviando...",
  "Thank you for connecting.": "Gracias por conectar con nosotros.",
  "Let’s stay connected.": "Sigamos en contacto.",
  "Thank you": "Gracias",
  "Thank you for connecting": "Gracias por conectar con nosotros",
  "It was a pleasure connecting with you. Leave your details so our team can follow up, pray with you, or help you take your next step.":
    "Fue un placer conocerle. Déjenos sus datos para que nuestro equipo pueda darle seguimiento, orar con usted y acompañarle en su próximo paso.",
  "Your details go to this church’s care team. You do not need a ChuFlow account.":
    "Sus datos se envían al equipo de atención de esta iglesia. No necesita una cuenta de ChuFlow.",
  "Your submission has been received.": "Hemos recibido su formulario.",
  "Form submitted": "Formulario enviado",
  "Submission failed": "No se pudo enviar el formulario",
  "Unable to submit form": "No se pudo enviar el formulario",
  "Complete the required fields": "Complete los campos obligatorios",
  "Please finish the highlighted step before submitting.":
    "Complete el paso indicado antes de enviar el formulario.",
  "Submitting your intake form...": "Enviando su formulario...",
  "Review & submit": "Revisar y enviar",
  "Review your answers before sending the form.":
    "Revise sus respuestas antes de enviar el formulario.",
  "Confirm your details before submitting.":
    "Confirme sus datos antes de enviar el formulario.",
  Welcome: "Bienvenido",
  "Member Intake Form": "Formulario de miembros",
  "First Timer Form": "Formulario de primera visita",
  "Submit First Timer Form": "Enviar formulario de primera visita",
  "Submit Member Form": "Enviar formulario de miembro",
  "Member growth, belonging, and formation in one record.":
    "Crecimiento, integración y formación del miembro en un solo registro.",
  "Help us keep your member record accurate":
    "Ayúdenos a mantener sus datos actualizados",
  "This form helps the church track membership, discipleship milestones, classes, and baptism journey with clarity.":
    "Este formulario ayuda a la iglesia a registrar la membresía, el discipulado, las clases y los bautismos.",
  "Thank you for staying planted and accountable in the house.":
    "Gracias por permanecer firme y comprometido con la iglesia.",
  "Jesus is Lord.": "Jesús es el Señor.",
  "Your first timer details have been received. Someone from the church will follow up with you soon.":
    "Hemos recibido los datos de su primera visita. Un integrante de la iglesia se pondrá en contacto con usted pronto.",
  "Please complete this first timer form with the information needed for follow-up, prayer, and your next step. We welcome you and pray that the word you received becomes a lasting testimony in your life.":
    "Complete este formulario de primera visita para que podamos darle seguimiento, orar por usted y acompañarle en su próximo paso. Le damos la bienvenida y oramos para que la palabra recibida se convierta en un testimonio duradero en su vida.",
  Yes: "Sí",
  No: "No",
  yes: "Sí",
  no: "No",
  Male: "Masculino",
  Female: "Femenino",
  Other: "Otro",
  "A friend": "Un amigo",
  "Evangelism (flyer)": "Evangelización (folleto)",
  active: "Activo",
  inactive: "Inactivo",
  worker: "Servidor",
  new_member: "Nuevo miembro",
  single: "Soltero/a",
  married: "Casado/a",
  divorced: "Divorciado/a",
  widowed: "Viudo/a",
  bro: "Hermano",
  sister: "Hermana",
  pastor: "Pastor",
  deacon: "Diácono",
  deaconess: "Diaconisa",
  apostle: "Apóstol",
  other: "Otro",
  "Personal details": "Datos personales",
  "Personal information": "Información personal",
  "Contact details": "Datos de contacto",
  "Contact & address": "Contacto y dirección",
  "Family & visit": "Familia y visita",
  "Spiritual growth": "Crecimiento espiritual",
  "Identity & membership": "Identidad y membresía",
  "Classes & formation": "Clases y formación",
  "Service & Baptism": "Servicio y bautismo",
  "Tell us who you are and how to reach you.":
    "Cuéntenos quién es y cómo podemos contactarle.",
  "Capture service-unit placement and baptism milestones.":
    "Indique sus grupos de servicio y los bautismos recibidos.",
  "Choose an option": "Seleccione una opción",
  "Select an option": "Seleccione una opción",
  "Not provided": "No proporcionado",
  "Not answered": "Sin respuesta",
  "This address can receive a confirmation email.":
    "Puede recibir un correo de confirmación en esta dirección.",
  "This list is filled automatically from active service units in the branch.":
    "Esta lista muestra los grupos de servicio activos de la sede.",
  "Select every service group this member serves in or intends to join in this branch.":
    "Seleccione todos los grupos en los que participa o desea participar en esta sede.",
};

const FIELD_LABELS: Record<string, string> = {
  title: "Título",
  firstName: "Nombre",
  lastName: "Apellido",
  email: "Correo electrónico",
  phone: "Teléfono",
  address: "Dirección",
  city: "Ciudad",
  state: "Estado o provincia",
  zipCode: "Código postal",
  gender: "Género",
  maritalStatus: "Estado civil",
  dateOfBirth: "Fecha de nacimiento",
  visitDate: "Fecha de la visita",
  cameWithFamily: "¿Vino con su familia?",
  heardAboutChurch: "¿Cómo se enteró de nuestra iglesia?",
  invitedBy: "¿Quién le invitó?",
  prayerRequest: "Petición de oración",
  wantsPastoralCall: "¿Desea recibir una llamada pastoral?",
  salvationResponse: "Respuesta al llamado de salvación",
  familyDetails: "Información familiar",
  membershipStatus: "Estado de membresía",
  dateJoinedChurch: "Fecha de ingreso a la iglesia",
  serviceUnitInterest: "Grupos de servicio",
  believerFoundationClassStatus:
    "¿Ha asistido a la Clase de Fundamentos para Creyentes?",
  believerFoundationClassDate: "Fecha o año de la clase",
  believerFoundationClassLocation: "Lugar de la clase",
  bccStatus: "¿Ha asistido a BCC?",
  bccDate: "Fecha de BCC",
  bccLocation: "Lugar de BCC",
  lccStatus: "¿Ha asistido a LCC?",
  lccDate: "Fecha de LCC",
  lccLocation: "Lugar de LCC",
  lcdStatus: "¿Ha asistido a LCD?",
  lcdDate: "Fecha de LCD",
  lcdLocation: "Lugar de LCD",
  holySpiritBaptismStatus: "Bautismo en el Espíritu Santo",
  waterBaptismStatus: "Bautismo en agua",
  spouseDetails: "Datos del cónyuge",
  children: "Hijos",
};

export function formText(
  value: string | undefined,
  language: FormLanguage,
): string {
  if (!value || language === "en") return value || "";
  if (SPANISH[value]) return SPANISH[value];
  const errors: [string, string][] = [
    [
      " is required before you continue.",
      " es obligatorio antes de continuar.",
    ],
    [" is required", " es obligatorio"],
    [" contains an invalid option.", " contiene una opción no válida."],
    [" must be a valid date.", " debe ser una fecha válida."],
    [" cannot be in the future.", " no puede ser una fecha futura."],
    [
      " must be a valid email address.",
      " debe ser un correo electrónico válido.",
    ],
    [" must be a valid phone number.", " debe ser un teléfono válido."],
    [" must be a valid number.", " debe ser un número válido."],
    [" cannot be negative.", " no puede ser negativo."],
  ];
  for (const [ending, translation] of errors)
    if (value.endsWith(ending))
      return formText(value.slice(0, -ending.length), language) + translation;
  return value;
}
export function formFieldLabel(
  field: { key: string; label: string; labelEs?: string },
  language: FormLanguage,
) {
  return language === "es"
    ? field.labelEs ||
        FIELD_LABELS[field.key] ||
        Object.entries(FIELD_LABELS).find(
          ([key]) =>
            key.toLowerCase() ===
            field.key.replace(/[^a-z0-9]/gi, "").toLowerCase(),
        )?.[1] ||
        formText(field.label, language)
    : field.label;
}
export function setFormLanguageInUrl(language: FormLanguage) {
  const url = new URL(window.location.href);
  url.searchParams.set("lang", language);
  window.history.replaceState(window.history.state, "", url);
}

export function localizedFormUrl(url: string, language: FormLanguage) {
  const result = new URL(url, "https://www.chuflow.com");
  if (language === "es") result.searchParams.set("lang", "es");
  else result.searchParams.delete("lang");
  return result.toString();
}

export function formOptionLabel(
  field: { options?: string[]; optionsEs?: string[] },
  value: string,
  language: FormLanguage,
) {
  const index = field.options?.indexOf(value) ?? -1;
  return language === "es"
    ? field.optionsEs?.[index] || formText(value, language)
    : value;
}
