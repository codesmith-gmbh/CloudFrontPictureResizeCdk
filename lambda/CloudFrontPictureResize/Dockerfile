# This Dockerfile is used by the cdk for bundling, we do no copy files as they will be mounted as a volume.
# This is necessary to extract the artificats after building.
FROM node:12.18

COPY . /development
RUN chmod a+rwX /development

ENTRYPOINT ["./tools/bundling/build.sh"]
