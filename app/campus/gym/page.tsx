"use client";

import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { useDictionary } from "@/app/components/LocaleProvider";

interface GymFacility {
  name: string;
  description: string;
  specs: string;
}

export default function GymPage() {
  const dictionary = useDictionary();
  const text = dictionary.pages.gym;

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          {text.title}
        </h1>
        <p className="text-neutral-600">{text.description}</p>
      </div>

      <Card className="mb-6 border border-neutral-200 bg-white" hover={false}>
        <h2 className="text-lg font-bold text-neutral-900 mb-4">
          {text.locationContact}
        </h2>
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-neutral-900">{text.location}</p>
            <p className="text-neutral-700">{text.locationName}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 border-t border-neutral-200 pt-3 sm:grid-cols-3">
            {text.contactInfo.map((info) => (
              <div key={info.title}>
                <p className="mb-1 text-xs font-medium text-neutral-500">
                  {info.title}
                </p>
                <a
                  href={`tel:${info.phone.replace(/-/g, "")}`}
                  className="font-semibold text-primary-700 hover:underline"
                >
                  {info.phone}
                </a>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card
        className="mb-6 border border-amber-200 bg-amber-50/70"
        hover={false}
      >
        <p className="text-sm leading-6 text-amber-900">{text.notice}</p>
      </Card>

      <FacilitySection
        title={text.sections.firstFloor}
        facilities={text.firstFloor}
      />
      <FacilitySection
        title={text.sections.secondFloor}
        facilities={text.secondFloor}
      />
      <FacilitySection title={text.sections.outdoor} facilities={text.outdoor} />

      <Card className="mb-6 border border-neutral-200 bg-white" hover={false}>
        <h2 className="text-lg font-bold text-neutral-900 mb-4">
          {text.usage.title}
        </h2>
        <div className="space-y-4 text-sm">
          <UsageBlock
            title={text.usage.registrationTitle}
            items={text.usage.registrationItems}
          />
          <UsageBlock
            title={text.usage.registrationTimeTitle}
            items={text.usage.registrationTimeItems}
          />
          <UsageBlock
            title={text.usage.refundTitle}
            items={text.usage.refundItems}
          />
          <UsageBlock
            title={text.usage.classChangeTitle}
            items={text.usage.classChangeItems}
          />
        </div>
      </Card>

      <Card className="mb-6 border border-neutral-200 bg-white" hover={false}>
        <h2 className="text-lg font-bold text-neutral-900 mb-3">
          {text.program.title}
        </h2>
        <p className="mb-4 text-sm text-neutral-700">
          {text.program.description}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="https://www.syu.ac.kr/sportscenter/program/program-guide/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {text.program.programLink}
          </a>
          <a
            href="https://www.syu.ac.kr/sportscenter/facilities/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {text.program.facilitiesLink}
          </a>
        </div>
      </Card>
    </Container>
  );
}

function FacilitySection({
  title,
  facilities,
}: {
  title: string;
  facilities: readonly GymFacility[];
}) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-neutral-900 mb-4 border-b-2 border-primary-600 pb-2">
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {facilities.map((facility) => (
          <Card key={facility.name}>
            <div className="mb-3">
              <h3 className="text-lg font-bold text-neutral-900 mb-2">
                {facility.name}
              </h3>
              <p className="text-sm text-neutral-600 mb-2">
                {facility.description}
              </p>
              <p className="text-xs text-neutral-500">{facility.specs}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function UsageBlock({
  title,
  items,
}: {
  title: string;
  items: readonly string[];
}) {
  return (
    <div>
      <h3 className="font-semibold text-neutral-900 mb-2">{title}</h3>
      <ul className="text-neutral-700 space-y-1 ml-4 list-disc">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
