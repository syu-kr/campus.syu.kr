"use client";

import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { useDictionary } from "@/app/components/LocaleProvider";

export default function HealthCenterPage() {
  const dictionary = useDictionary();
  const text = dictionary.pages.healthCenter;

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          {text.title}
        </h1>
        <p className="text-neutral-600">{text.description}</p>
      </div>

      <Card className="mb-6 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200">
        <h2 className="text-lg font-bold text-blue-900 mb-4">
          {text.locationContact}
        </h2>
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-blue-900">{text.location}</p>
            <p className="text-blue-800">{text.locationName}</p>
          </div>
          <div>
            <p className="font-semibold text-blue-900">{text.phone}</p>
            <a
              href="tel:0233993182"
              className="text-blue-600 hover:underline font-semibold text-lg"
            >
              02-3399-3182
            </a>
          </div>
        </div>
      </Card>

      <Card className="mb-6 border border-red-200 bg-red-50" hover={false}>
        <p className="text-sm leading-6 text-red-900">
          {text.emergencyNotice}
        </p>
      </Card>

      <div className="mb-6">
        <h2 className="text-lg font-bold text-neutral-900 mb-4">
          {text.operatingHours}
        </h2>
        <Card>
          <div className="space-y-3">
            {text.schedule.map((item) => (
              <div key={item.day} className="flex justify-between text-sm">
                <span className="font-medium text-neutral-900">{item.day}</span>
                <span className="text-neutral-600">{item.time}</span>
              </div>
            ))}
            <div className="text-xs text-neutral-500 border-t pt-3 mt-3">
              {text.vacationNoticeLine1}
              <br />
              {text.vacationNoticeLine2}
            </div>
          </div>
        </Card>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-bold text-neutral-900 mb-4">
          {text.servicesTitle}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {text.services.map((service) => (
            <Card
              key={service.title}
              className="hover:shadow-card-hover transition-shadow"
            >
              <div className="text-center">
                <h3 className="font-semibold text-neutral-900 text-sm mb-1">
                  {service.title}
                </h3>
                <p className="text-xs text-neutral-600">
                  {service.description}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Card className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
        <h2 className="text-lg font-bold text-green-900 mb-4">
          {text.processTitle}
        </h2>
        <div className="grid grid-cols-4 gap-4">
          {text.processSteps.map((step) => (
            <div key={step.num} className="text-center">
              <div className="bg-green-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold mx-auto mb-2 text-lg">
                {step.num}
              </div>
              <p className="font-semibold text-green-900 text-sm mb-1">
                {step.title}
              </p>
              <p className="text-xs text-green-800">{step.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="mb-6">
        <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
          {text.noticesTitle}
        </h2>
        <Card>
          <div className="space-y-4">
            {text.notices.map((notice) => (
              <div key={notice.title}>
                <h3 className="font-semibold text-neutral-900 mb-2">
                  {notice.title}
                </h3>
                <p className="text-sm text-neutral-600">
                  {notice.body}
                  {notice.note && (
                    <>
                      <br />
                      <span className="text-xs text-neutral-500">
                        {notice.note}
                      </span>
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Container>
  );
}
